import { Hono } from "hono";
import type { Entorno } from "./auth";
import { requiereUsuario } from "./auth";
import { eventoRifa } from "./eventos";
import { generarId } from "./lista";
import { baseDeSlug, esquemaNuevaRifa } from "./rifas-esquema";
import { mostrarCodigo, vencerReservas } from "./reservas";
import { avanzarRifa } from "./cierre";
import { resolverSorteo } from "./sorteos";
import { resumenOrganizador } from "./organizadores";
import { sha256, tramoPara } from "@rifaclara/shared";

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
  foto: string | null;
  og: string | null;
  creado_en: number;
}

/** Ruta pública de una imagen guardada en R2 (la sirve la web en /fotos/*). */
const urlFoto = (clave: string | null) => (clave ? `/fotos/${clave}` : null);

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
  // Hasta 100 números se publica al tiro; las más grandes esperan el pago único.
  const tramo = tramoPara(d.hasta - d.desde + 1)!;
  const estado = tramo.precio > 0 ? "pago_pendiente" : "abierta";
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO rifas (id, slug, usuario_id, titulo, descripcion, premios, precio, desde, hasta, medios_pago,
         whatsapp, cierre_en, horas_reserva, max_por_persona, estado, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, slug, usuario.id, d.titulo, d.descripcion || null, JSON.stringify(d.premios), d.precio, d.desde, d.hasta,
      d.mediosPago, d.whatsapp || null, d.cierreEn, d.horasReserva, d.maxPorPersona, estado, t, t),
    await eventoRifa(c.env.DB, id, "creada", { titulo: d.titulo, premios: d.premios, precio: d.precio, desde: d.desde, hasta: d.hasta, cierreEn: d.cierreEn }),
  ]);
  return c.json({ id, slug, requierePago: tramo.precio > 0, precio: tramo.precio }, 201);
});

/** Rifas del organizador, con cuántos números hay pagados y reservados. */
rifas.get("/", requiereUsuario, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.slug, r.titulo, r.estado, r.cierre_en AS cierreEn, r.desde, r.hasta, r.precio, r.foto,
       COALESCE(SUM(CASE WHEN s.estado = 'pagada' THEN 1 ELSE 0 END), 0) AS pagados,
       COALESCE(SUM(CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 0 END), 0) AS reservados
     FROM rifas r
     LEFT JOIN numeros n ON n.rifa_id = r.id
     LEFT JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE r.usuario_id = ?
     GROUP BY r.id
     ORDER BY r.creado_en DESC`,
  ).bind(c.get("usuario")!.id).all<{ foto: string | null }>();
  return c.json({ rifas: results.map((x) => ({ ...x, foto: urlFoto(x.foto) })) });
});

/** Una rifa del organizador con todas sus reservas, para el panel. */
rifas.get("/:id/reservas", requiereUsuario, async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM rifas WHERE id = ? AND usuario_id = ?")
    .bind(c.req.param("id"), c.get("usuario")!.id).first<FilaRifa>();
  if (!r) return c.json({ error: "No existe esa rifa en tu cuenta." }, 404);
  await vencerReservas(c.env.DB, r.id);
  await avanzarRifa(c.env.DB, r.id);
  const actual = (await c.env.DB.prepare("SELECT estado, sorteo_id FROM rifas WHERE id = ?").bind(r.id).first<{ estado: string; sorteo_id: string | null }>())!;
  r.estado = actual.estado;
  r.sorteo_id = actual.sorteo_id;
  const s = r.sorteo_id ? await resolverSorteo(c.env.DB, r.sorteo_id) : null;
  // El organizador ve a quién le tocó cada premio para poder contactarlo.
  const ganadores = [];
  for (const g of s?.ganadores ?? []) {
    const p = await c.env.DB.prepare(
      "SELECT s.nombre, s.telefono, s.codigo FROM numeros n JOIN reservas s ON s.codigo = n.reserva_codigo WHERE n.rifa_id = ? AND n.numero = ?",
    ).bind(r.id, g.nombre).first<{ nombre: string; telefono: string; codigo: string }>();
    ganadores.push({ premio: g.premio, numero: g.nombre, nombre: p?.nombre ?? null, telefono: p?.telefono ?? null, codigo: p ? mostrarCodigo(p.codigo) : null });
  }
  const { results } = await c.env.DB.prepare(
    `SELECT codigo, nombre, telefono, numeros, estado, vence_en AS venceEn, creado_en AS creadoEn, pagada_en AS pagadaEn
     FROM reservas WHERE rifa_id = ? ORDER BY (estado = 'pendiente') DESC, creado_en DESC LIMIT 500`,
  ).bind(r.id).all<{ codigo: string; numeros: string } & Record<string, unknown>>();
  return c.json({
    rifa: {
      id: r.id, slug: r.slug, titulo: r.titulo, estado: r.estado, precio: r.precio, desde: r.desde, hasta: r.hasta,
      cierreEn: r.cierre_en, zonaHoraria: r.zona_horaria, sorteoId: r.sorteo_id, premios: JSON.parse(r.premios) as string[],
      foto: urlFoto(r.foto), og: urlFoto(r.og),
    },
    sorteo: s && { id: s.id, estado: s.estado, ronda: s.ronda, momento: s.momento, numerosEnSorteo: s.lista.length },
    ganadores,
    reservas: results.map((x) => ({ ...x, codigo: mostrarCodigo(x.codigo), numeros: JSON.parse(x.numeros) as string[] })),
  });
});

/**
 * Rifas que Google puede indexar: públicas y visibles (abiertas, cerradas o
 * sorteadas en los últimos 60 días). Alimenta /sitemap-rifas.xml.
 */
rifas.get("/indexables", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, actualizado_en AS actualizadoEn FROM rifas
     WHERE visibilidad = 'publica' AND estado IN ('abierta', 'cerrada', 'sorteada')
       AND (estado = 'abierta' OR actualizado_en > ?)
     ORDER BY actualizado_en DESC LIMIT 5000`,
  ).bind(ahora() - 60 * 86400).all<{ slug: string; actualizadoEn: number }>();
  return c.json({ rifas: results }, 200, { "cache-control": "public, max-age=3600" });
});

/**
 * Estado liviano de la grilla para actualizarla en vivo: solo qué números están
 * tomados. Responde 304 si nada cambió desde la última consulta (ETag).
 */
rifas.get("/publica/:slug/estado", async (c) => {
  const r = await c.env.DB.prepare("SELECT id, estado, cierre_en FROM rifas WHERE slug = ? AND estado NOT IN ('cancelada', 'pago_pendiente')")
    .bind(c.req.param("slug")).first<{ id: string; estado: string; cierre_en: number }>();
  if (!r) return c.json({ error: "No existe esa rifa" }, 404);
  await vencerReservas(c.env.DB, r.id);
  const { results } = await c.env.DB.prepare(
    `SELECT n.numero AS n, CASE s.estado WHEN 'pagada' THEN 'p' ELSE 'r' END AS e
     FROM numeros n JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE n.rifa_id = ? AND s.estado IN ('pendiente', 'pagada') ORDER BY n.numero`,
  ).bind(r.id).all<{ n: string; e: "p" | "r" }>();
  // Pasada la hora de cierre la página se recarga para mostrar el sorteo.
  const estado = r.estado === "abierta" && ahora() >= r.cierre_en ? "cerrando" : r.estado;
  const cuerpo = JSON.stringify({ estado, tomados: results });
  const etag = `"${(await sha256(cuerpo)).slice(0, 16)}"`;
  const cabeceras = { etag, "cache-control": "no-cache" };
  // Al comprimir, Cloudflare puede volver débil el ETag (W/"..."): da lo mismo para comparar.
  if (c.req.header("if-none-match")?.replace(/^W\//, "") === etag) return c.body(null, 304, cabeceras);
  return c.body(cuerpo, 200, { ...cabeceras, "content-type": "application/json" });
});

/** Vista pública: sin datos del organizador ni de los participantes. */
rifas.get("/publica/:slug", async (c) => {
  const buscar = () => c.env.DB.prepare("SELECT * FROM rifas WHERE slug = ? AND estado NOT IN ('cancelada', 'pago_pendiente')")
    .bind(c.req.param("slug")).first<FilaRifa>();
  const previa = await buscar();
  if (!previa) return c.json({ error: "No existe esa rifa" }, 404);
  // Quien mira la rifa justo después de la hora de cierre dispara el cierre y el sorteo.
  await vencerReservas(c.env.DB, previa.id);
  await avanzarRifa(c.env.DB, previa.id);
  const r = (await buscar())!;
  const s = r.sorteo_id ? await resolverSorteo(c.env.DB, r.sorteo_id) : null;
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
    foto: urlFoto(r.foto),
    og: urlFoto(r.og),
    organizador: await resumenOrganizador(c.env.DB, r.usuario_id),
    tomados,
    resultado: s && {
      sorteoId: s.id,
      estado: s.estado,
      ronda: s.ronda,
      momento: s.momento,
      huella: s.huella,
      numerosEnSorteo: s.lista.length,
      premios: s.premios,
      ganadores: s.ganadores.map((g) => ({ premio: g.premio, numero: g.nombre })),
    },
  });
});
