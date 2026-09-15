import { Hono } from "hono";
import { z } from "zod";
import { requiereUsuario, type Entorno } from "./auth";
import { enviarCorreo } from "./correo";
import { eventoRifa } from "./eventos";
import { generarId } from "./lista";

const ahora = () => Math.floor(Date.now() / 1000);

/** Motivos cerrados: así se pueden ordenar y nadie escribe datos de más. */
export const MOTIVOS = {
  no_entrega: "No entregaron el premio",
  estafa: "Parece una estafa",
  ilegal: "Contenido ilegal u ofensivo",
  datos: "Publica datos de otra persona",
  otro: "Otro problema",
} as const;

// Tope por rifa: evita que una sola rifa llene la tabla a punta de denuncias.
const MAX_ABIERTAS_POR_RIFA = 20;

export const esquemaDenuncia = z.object({
  motivo: z.enum(Object.keys(MOTIVOS) as [keyof typeof MOTIVOS], { message: "Elige un motivo" }),
  detalle: z.string().trim().max(600, "El detalle puede tener hasta 600 caracteres").default(""),
  contacto: z.string().trim().max(120).default(""),
  sitio: z.string().max(0).optional(),
});

const esAdmin = (c: { env: CloudflareBindings; get: (k: "usuario") => { email: string } | null }) =>
  !!c.env.ADMIN_CORREO && c.get("usuario")?.email === c.env.ADMIN_CORREO;

export const denuncias = new Hono<Entorno>();

/** Cualquiera puede reportar una rifa, sin cuenta. */
denuncias.post("/rifa/:slug", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  if (!(await c.env.LIMITE_FORMULARIOS.limit({ key: `denuncia:${ip}` })).success) {
    return c.json({ error: "Enviaste varios reportes seguidos. Espera un minuto." }, 429);
  }
  const datos = esquemaDenuncia.safeParse(await c.req.json().catch(() => null));
  if (!datos.success && datos.error.issues.some((i) => i.path[0] === "sitio")) return c.json({ ok: true });
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const { motivo, detalle, contacto } = datos.data;

  const rifa = await c.env.DB.prepare("SELECT id, titulo, slug, usuario_id FROM rifas WHERE slug = ?")
    .bind(c.req.param("slug")).first<{ id: string; titulo: string; slug: string; usuario_id: string }>();
  if (!rifa) return c.json({ error: "No existe esa rifa" }, 404);

  const abiertas = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM denuncias WHERE rifa_id = ? AND estado = 'abierta'")
    .bind(rifa.id).first<{ n: number }>();
  if ((abiertas?.n ?? 0) >= MAX_ABIERTAS_POR_RIFA) return c.json({ ok: true });

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO denuncias (id, rifa_id, motivo, detalle, contacto, creado_en) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(generarId(12), rifa.id, motivo, detalle || null, contacto || null, ahora()),
    // En el registro público de la rifa solo queda el motivo, nunca quién denunció.
    await eventoRifa(c.env.DB, rifa.id, "denuncia", { motivo }),
  ]);

  if (c.env.ADMIN_CORREO && c.env.RESEND_API_KEY) {
    const enlace = `${c.env.SITIO}/panel/denuncias`;
    c.executionCtx.waitUntil(enviarCorreo(c.env, {
      para: c.env.ADMIN_CORREO,
      asunto: `Denuncia en Rifa Clara: ${rifa.titulo}`,
      texto: `Motivo: ${MOTIVOS[motivo]}\nRifa: ${c.env.SITIO}/r/${rifa.slug}\nDetalle: ${detalle || "(sin detalle)"}\nContacto: ${contacto || "(no dejó)"}\n\nRevisar: ${enlace}`,
      html: `<p><b>Motivo:</b> ${MOTIVOS[motivo]}</p><p><b>Rifa:</b> <a href="${c.env.SITIO}/r/${rifa.slug}">${rifa.titulo}</a></p>
<p><b>Detalle:</b> ${detalle ? escapar(detalle) : "(sin detalle)"}</p><p><b>Contacto:</b> ${contacto ? escapar(contacto) : "(no dejó)"}</p>
<p><a href="${enlace}">Revisar las denuncias</a></p>`,
    }));
  }
  return c.json({ ok: true });
});

/** Bandeja de quien administra el sitio. */
denuncias.get("/", requiereUsuario, async (c) => {
  if (!esAdmin(c)) return c.json({ error: "No tienes acceso a esto." }, 403);
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.motivo, d.detalle, d.contacto, d.estado, d.nota, d.creado_en AS creadoEn, d.resuelto_en AS resueltoEn,
       r.slug, r.titulo, r.estado AS estadoRifa, u.email AS organizador
     FROM denuncias d JOIN rifas r ON r.id = d.rifa_id JOIN usuarios u ON u.id = r.usuario_id
     ORDER BY (d.estado = 'abierta') DESC, d.creado_en DESC LIMIT 200`,
  ).all();
  return c.json({ denuncias: results, motivos: MOTIVOS });
});

/** Revisar una denuncia: descartarla, marcarla vista o cancelar la rifa. */
denuncias.post("/:id", requiereUsuario, async (c) => {
  if (!esAdmin(c)) return c.json({ error: "No tienes acceso a esto." }, 403);
  const datos = z.object({
    accion: z.enum(["revisada", "descartada", "cancelar_rifa"]),
    nota: z.string().trim().max(300).default(""),
  }).safeParse(await c.req.json().catch(() => null));
  if (!datos.success) return c.json({ error: "Datos inválidos" }, 400);

  const d = await c.env.DB.prepare("SELECT id, rifa_id FROM denuncias WHERE id = ?")
    .bind(c.req.param("id")).first<{ id: string; rifa_id: string }>();
  if (!d) return c.json({ error: "No existe esa denuncia" }, 404);

  const estado = datos.data.accion === "descartada" ? "descartada" : "revisada";
  const ordenes = [
    c.env.DB.prepare("UPDATE denuncias SET estado = ?, nota = ?, resuelto_en = ? WHERE id = ?")
      .bind(estado, datos.data.nota || null, ahora(), d.id),
  ];
  if (datos.data.accion === "cancelar_rifa") {
    ordenes.push(
      c.env.DB.prepare("UPDATE rifas SET estado = 'cancelada', actualizado_en = ? WHERE id = ?").bind(ahora(), d.rifa_id),
      await eventoRifa(c.env.DB, d.rifa_id, "cancelada", { por: "denuncia", nota: datos.data.nota || null }),
    );
  }
  await c.env.DB.batch(ordenes);
  return c.json({ ok: true, estado });
});

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
