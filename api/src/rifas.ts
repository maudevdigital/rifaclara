import { Hono } from "hono";
import type { Entorno } from "./auth";
import { requiereUsuario } from "./auth";
import { eventoRifa } from "./eventos";
import { generarId } from "./lista";
import { baseDeSlug, esquemaNuevaRifa } from "./rifas-esquema";

interface FilaRifa {
  id: string;
  slug: string;
  usuario_id: string;
  titulo: string;
  descripcion: string | null;
  premios: string;
  precio: number;
  desde: number;
  hasta: number;
  medios_pago: string;
  whatsapp: string | null;
  cierre_en: number;
  horas_reserva: number;
  max_por_persona: number;
  estado: string;
  visibilidad: string;
  moneda: string;
  zona_horaria: string;
  sorteo_id: string | null;
  creado_en: number;
}

const ahora = () => Math.floor(Date.now() / 1000);

export const rifas = new Hono<Entorno>();

rifas.post("/", requiereUsuario, async (c) => {
  const datos = esquemaNuevaRifa.safeParse(await c.req.json().catch(() => null));
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const d = datos.data;
  const usuario = c.get("usuario")!;
  const id = crypto.randomUUID();
  const slug = `${baseDeSlug(d.titulo)}-${generarId(4)}`;
  const t = ahora();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO rifas (id, slug, usuario_id, titulo, descripcion, premios, precio, desde, hasta, medios_pago,
         whatsapp, cierre_en, horas_reserva, max_por_persona, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, slug, usuario.id, d.titulo, d.descripcion || null, JSON.stringify(d.premios), d.precio, d.desde, d.hasta,
      d.mediosPago, d.whatsapp || null, d.cierreEn, d.horasReserva, d.maxPorPersona, t, t),
    await eventoRifa(c.env.DB, id, "creada", { titulo: d.titulo, premios: d.premios, precio: d.precio, desde: d.desde, hasta: d.hasta, cierreEn: d.cierreEn }),
  ]);
  return c.json({ id, slug }, 201);
});

/** Rifas del organizador, con cuántos números hay pagados y reservados. */
rifas.get("/", requiereUsuario, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.slug, r.titulo, r.estado, r.cierre_en AS cierreEn, r.desde, r.hasta, r.precio,
       COALESCE(SUM(CASE WHEN s.estado = 'pagada' THEN 1 ELSE 0 END), 0) AS pagados,
       COALESCE(SUM(CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 0 END), 0) AS reservados
     FROM rifas r
     LEFT JOIN numeros n ON n.rifa_id = r.id
     LEFT JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE r.usuario_id = ?
     GROUP BY r.id
     ORDER BY r.creado_en DESC`,
  ).bind(c.get("usuario")!.id).all();
  return c.json({ rifas: results });
});

/** Vista pública: sin datos del organizador ni de los participantes. */
rifas.get("/publica/:slug", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM rifas WHERE slug = ? AND estado != 'cancelada'")
    .bind(c.req.param("slug")).first<FilaRifa>();
  if (!r) return c.json({ error: "No existe esa rifa" }, 404);
  const { results: tomados } = await c.env.DB.prepare(
    `SELECT n.numero AS n, CASE s.estado WHEN 'pagada' THEN 'p' ELSE 'r' END AS e
     FROM numeros n JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE n.rifa_id = ? AND s.estado IN ('pendiente', 'pagada')`,
  ).bind(r.id).all<{ n: string; e: "p" | "r" }>();
  return c.json({
    slug: r.slug,
    titulo: r.titulo,
    descripcion: r.descripcion,
    premios: JSON.parse(r.premios) as string[],
    precio: r.precio,
    moneda: r.moneda,
    desde: r.desde,
    hasta: r.hasta,
    cierreEn: r.cierre_en,
    zonaHoraria: r.zona_horaria,
    estado: r.estado,
    horasReserva: r.horas_reserva,
    maxPorPersona: r.max_por_persona,
    sorteoId: r.sorteo_id,
    tomados,
  });
});
