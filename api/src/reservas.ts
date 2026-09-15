import { Hono } from "hono";
import { z } from "zod";
import type { Entorno } from "./auth";
import { requiereUsuario } from "./auth";
import { eventoRifa } from "./eventos";
import { generarId } from "./lista";
import { sha256 } from "@rifaclara/shared";
import { avanzarRifa } from "./cierre";
import { resolverSorteo } from "./sorteos";

const ahora = () => Math.floor(Date.now() / 1000);

/** Teléfonos chilenos de 9 dígitos que empiezan con 9 se guardan con el 56 adelante. */
export function normalizarTelefono(t: string): string {
  const d = t.replace(/\D/g, "");
  return /^9\d{8}$/.test(d) ? `56${d}` : d;
}

/** El código del boleto se muestra como RC-XXXXX-XXXXX. */
export const mostrarCodigo = (c: string) => `RC-${c.slice(0, 5)}-${c.slice(5)}`.toUpperCase();
export const leerCodigo = (c: string) => c.toLowerCase().replace(/^rc-?/, "").replace(/-/g, "");

export const esquemaReserva = z.object({
  numeros: z.array(z.string().regex(/^\d{1,5}$/)).min(1, "Elige al menos un número").max(50),
  nombre: z.string().trim().min(2, "Escribe tu nombre").max(60),
  telefono: z.string().transform(normalizarTelefono).refine((t) => /^\d{8,15}$/.test(t), "Revisa tu WhatsApp: deben ser entre 8 y 15 dígitos"),
  sitio: z.string().max(0).optional(),
});

interface Rifa {
  id: string; titulo: string; slug: string; usuario_id: string; desde: number; hasta: number; precio: number;
  estado: string; cierre_en: number; horas_reserva: number; max_por_persona: number;
}

/**
 * Pasa a "vencida" las reservas pendientes cuyo plazo terminó y libera sus
 * números. Se llama antes de reservar, al mostrar la rifa y cada 10 minutos.
 */
export async function vencerReservas(db: D1Database, rifaId?: string) {
  const filtro = rifaId ? " AND rifa_id = ?" : "";
  const args = rifaId ? [ahora(), rifaId] : [ahora()];
  const hay = await db.prepare(`SELECT 1 FROM reservas WHERE estado = 'pendiente' AND vence_en < ?${filtro} LIMIT 1`).bind(...args).first();
  if (!hay) return;
  const { results } = await db.prepare(
    `UPDATE reservas SET estado = 'vencida' WHERE estado = 'pendiente' AND vence_en < ?${filtro} RETURNING codigo, rifa_id`,
  ).bind(...args).all<{ codigo: string; rifa_id: string }>();
  // Uno por uno: cada evento se encadena con el hash del anterior ya guardado.
  for (const r of results) {
    await db.batch([
      db.prepare("DELETE FROM numeros WHERE reserva_codigo = ?").bind(r.codigo),
      await eventoRifa(db, r.rifa_id, "reserva_vencida", { codigo: r.codigo }),
    ]);
  }
}

export const reservas = new Hono<Entorno>();

/** Reservar números de una rifa. No requiere cuenta. */
reservas.post("/rifa/:slug", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  if (!(await c.env.LIMITE_FORMULARIOS.limit({ key: `reserva:${ip}` })).success) {
    return c.json({ error: "Hiciste varias reservas seguidas. Espera un minuto." }, 429);
  }
  const datos = esquemaReserva.safeParse(await c.req.json().catch(() => null));
  if (!datos.success && datos.error.issues.some((i) => i.path[0] === "sitio")) return c.json({ error: "No se pudo reservar." }, 400);
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const { nombre, telefono } = datos.data;
  const numeros = [...new Set(datos.data.numeros)];

  const r = await c.env.DB.prepare("SELECT * FROM rifas WHERE slug = ?").bind(c.req.param("slug")).first<Rifa>();
  if (!r) return c.json({ error: "No existe esa rifa." }, 404);
  if (r.estado !== "abierta" || ahora() >= r.cierre_en) return c.json({ error: "Esta rifa ya cerró sus reservas." }, 409);
  const ancho = String(r.hasta).length;
  if (numeros.some((n) => n.length !== ancho || Number(n) < r.desde || Number(n) > r.hasta)) {
    return c.json({ error: "Alguno de los números no es de esta rifa." }, 400);
  }

  await vencerReservas(c.env.DB, r.id);
  const previos = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM numeros n JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE s.rifa_id = ? AND s.telefono = ? AND s.estado IN ('pendiente', 'pagada')`,
  ).bind(r.id, telefono).first<{ n: number }>();
  if ((previos?.n ?? 0) + numeros.length > r.max_por_persona) {
    return c.json({ error: `Cada persona puede tener hasta ${r.max_por_persona} números en esta rifa.` }, 400);
  }

  const codigo = generarId(10);
  // La reserva no puede durar más allá del cierre.
  const vence = Math.min(ahora() + r.horas_reserva * 3600, r.cierre_en);
  try {
    // Un solo batch = una transacción: si otro tomó uno de los números un
    // instante antes, la PK de `numeros` hace fallar todo y nada queda a medias.
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO reservas (codigo, rifa_id, nombre, telefono, numeros, vence_en, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(codigo, r.id, nombre, telefono, JSON.stringify([...numeros].sort()), vence, ahora()),
      ...numeros.map((n) => c.env.DB.prepare("INSERT INTO numeros (rifa_id, numero, reserva_codigo) VALUES (?, ?, ?)").bind(r.id, n, codigo)),
      await eventoRifa(c.env.DB, r.id, "reservada", { codigo, numeros }),
    ]);
  } catch (e) {
    if (!String(e).includes("UNIQUE")) throw e;
    const marcadores = numeros.map(() => "?").join(",");
    const { results } = await c.env.DB.prepare(`SELECT numero FROM numeros WHERE rifa_id = ? AND numero IN (${marcadores})`)
      .bind(r.id, ...numeros).all<{ numero: string }>();
    const tomados = results.map((x) => x.numero);
    return c.json({ error: `Alguien acaba de tomar ${tomados.length === 1 ? "el número" : "los números"} ${tomados.join(", ")}. Elige otro.`, tomados }, 409);
  }
  return c.json({ codigo: mostrarCodigo(codigo) }, 201);
});

/** Boleto: quien tiene el código ve su reserva y cómo pagar. */
reservas.get("/:codigo", async (c) => {
  const codigo = leerCodigo(c.req.param("codigo"));
  const fila = await c.env.DB.prepare(
    `SELECT s.codigo, s.nombre, s.telefono, s.numeros, s.estado, s.vence_en, s.creado_en, s.pagada_en,
       r.slug, r.titulo, r.premios, r.precio, r.cierre_en, r.zona_horaria, r.medios_pago, r.whatsapp, r.estado AS estado_rifa, r.id AS rifa_id
     FROM reservas s JOIN rifas r ON r.id = s.rifa_id WHERE s.codigo = ?`,
  ).bind(codigo).first<Record<string, string | number | null>>();
  if (!fila) return c.json({ error: "No existe ese boleto." }, 404);
  const rifaId = String(fila.rifa_id);
  await vencerReservas(c.env.DB, rifaId);
  await avanzarRifa(c.env.DB, rifaId);
  const rifa = (await c.env.DB.prepare("SELECT estado, sorteo_id FROM rifas WHERE id = ?").bind(rifaId).first<{ estado: string; sorteo_id: string | null }>())!;
  const reserva = (await c.env.DB.prepare("SELECT estado FROM reservas WHERE codigo = ?").bind(codigo).first<{ estado: string }>())!;
  const estado = reserva.estado === "pendiente" && Number(fila.vence_en) < ahora() ? "vencida" : reserva.estado;
  const numeros = JSON.parse(String(fila.numeros)) as string[];

  // Resultado para esta persona: si sus números estuvieron en la lista sellada y si ganó.
  const huella = await sha256(mostrarCodigo(codigo));
  const s = rifa.sorteo_id ? await resolverSorteo(c.env.DB, rifa.sorteo_id) : null;
  const resultado = s && {
    sorteoId: s.id,
    estado: s.estado,
    huellaBoleto: huella,
    enLista: numeros.filter((n) => s.lista.includes(`${n}:${huella}`)),
    ganados: s.ganadores.filter((g) => numeros.includes(g.nombre) && s.lista.includes(`${g.nombre}:${huella}`)).map((g) => ({ premio: g.premio, numero: g.nombre })),
  };
  const telefono = String(fila.telefono);
  return c.json({
    codigo: mostrarCodigo(codigo),
    nombre: fila.nombre,
    telefono: `+${telefono.slice(0, -4).replace(/\d/g, "•")}${telefono.slice(-4)}`,
    estado,
    numeros,
    resultado,
    venceEn: fila.vence_en,
    pagadaEn: fila.pagada_en,
    rifa: {
      slug: fila.slug, titulo: fila.titulo, premios: JSON.parse(String(fila.premios)), precio: fila.precio,
      cierreEn: fila.cierre_en, zonaHoraria: fila.zona_horaria, mediosPago: fila.medios_pago, whatsapp: fila.whatsapp, estado: rifa.estado,
    },
  });
});

async function reservaDelOrganizador(c: { env: CloudflareBindings; get: (k: "usuario") => Entorno["Variables"]["usuario"] }, codigo: string) {
  return c.env.DB.prepare(
    "SELECT s.codigo, s.estado, s.rifa_id, r.estado AS estado_rifa FROM reservas s JOIN rifas r ON r.id = s.rifa_id WHERE s.codigo = ? AND r.usuario_id = ?",
  ).bind(leerCodigo(codigo), c.get("usuario")!.id).first<{ codigo: string; estado: string; rifa_id: string; estado_rifa: string }>();
}

reservas.post("/:codigo/pagar", requiereUsuario, async (c) => {
  const s = await reservaDelOrganizador(c, c.req.param("codigo"));
  if (!s) return c.json({ error: "No existe esa reserva en tus rifas." }, 404);
  if (s.estado_rifa !== "abierta") return c.json({ error: "La rifa ya cerró: no se pueden cambiar pagos." }, 409);
  if (s.estado !== "pendiente") return c.json({ error: `La reserva está ${s.estado}.` }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reservas SET estado = 'pagada', pagada_en = ? WHERE codigo = ? AND estado = 'pendiente'").bind(ahora(), s.codigo),
    await eventoRifa(c.env.DB, s.rifa_id, "pagada", { codigo: s.codigo }),
  ]);
  return c.json({ ok: true });
});

reservas.post("/:codigo/liberar", requiereUsuario, async (c) => {
  const s = await reservaDelOrganizador(c, c.req.param("codigo"));
  if (!s) return c.json({ error: "No existe esa reserva en tus rifas." }, 404);
  if (s.estado_rifa !== "abierta") return c.json({ error: "La rifa ya cerró: no se pueden liberar números." }, 409);
  if (s.estado !== "pendiente") return c.json({ error: "Solo se liberan reservas que no se han pagado." }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reservas SET estado = 'liberada' WHERE codigo = ?").bind(s.codigo),
    c.env.DB.prepare("DELETE FROM numeros WHERE reserva_codigo = ?").bind(s.codigo),
    await eventoRifa(c.env.DB, s.rifa_id, "liberada", { codigo: s.codigo }),
  ]);
  return c.json({ ok: true });
});
