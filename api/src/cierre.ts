import { sha256 } from "@rifaclara/shared";
import type { SorteoPublico } from "@rifaclara/shared";
import { eventoRifa } from "./eventos";
import { mostrarCodigo } from "./reservas";
import { nuevoSorteo, resolverSorteo } from "./sorteos";

const ahora = () => Math.floor(Date.now() / 1000);

interface RifaCierre {
  id: string;
  titulo: string;
  premios: string;
  estado: string;
  cierre_en: number;
  sorteo_id: string | null;
}

/**
 * Lista congelada del sorteo: una línea por número pagado, en orden,
 * "047:sha256(código de boleto)". Quien tiene el boleto reconoce su línea;
 * los demás no ven nombres ni teléfonos.
 */
export async function lineasPlataforma(pagados: { numero: string; codigo: string }[]): Promise<string[]> {
  const lineas = await Promise.all(pagados.map(async (p) => `${p.numero}:${await sha256(mostrarCodigo(p.codigo))}`));
  return lineas.sort((a, b) => Number(a.slice(0, a.indexOf(":"))) - Number(b.slice(0, b.indexOf(":"))));
}

/**
 * Cierra la rifa si ya llegó su hora: vence las reservas sin pagar, congela
 * la lista de números pagados y registra el sorteo con una ronda futura.
 */
async function cerrar(db: D1Database, r: RifaCierre) {
  // Solo una ejecución toma la rifa: la que logra pasarla de "abierta" a "cerrando".
  // Si algo falla a medio camino, "cerrando" se reintenta en la próxima pasada.
  if (r.estado === "abierta") {
    const tomada = await db.prepare("UPDATE rifas SET estado = 'cerrando' WHERE id = ? AND estado = 'abierta' AND cierre_en <= ? RETURNING id")
      .bind(r.id, ahora()).first();
    if (!tomada) return;
  }
  const { results: pendientes } = await db.prepare("SELECT codigo FROM reservas WHERE rifa_id = ? AND estado = 'pendiente'")
    .bind(r.id).all<{ codigo: string }>();
  for (const p of pendientes) {
    await db.batch([
      db.prepare("UPDATE reservas SET estado = 'vencida' WHERE codigo = ?").bind(p.codigo),
      db.prepare("DELETE FROM numeros WHERE reserva_codigo = ?").bind(p.codigo),
      await eventoRifa(db, r.id, "reserva_vencida", { codigo: p.codigo, motivo: "cierre" }),
    ]);
  }

  const { results: pagados } = await db.prepare(
    `SELECT n.numero, s.codigo FROM numeros n JOIN reservas s ON s.codigo = n.reserva_codigo
     WHERE n.rifa_id = ? AND s.estado = 'pagada'`,
  ).bind(r.id).all<{ numero: string; codigo: string }>();
  const t = ahora();

  if (pagados.length === 0) {
    await db.batch([
      db.prepare("UPDATE rifas SET estado = 'cerrada', actualizado_en = ? WHERE id = ?").bind(t, r.id),
      await eventoRifa(db, r.id, "cerrada_sin_ventas", {}),
    ]);
    return;
  }

  const lista = await lineasPlataforma(pagados);
  const premios = Math.min((JSON.parse(r.premios) as string[]).length, lista.length);
  const { sentencia, creado } = await nuevoSorteo(db, { tipo: "plataforma", titulo: r.titulo, lista, premios });
  await db.batch([
    sentencia,
    db.prepare("UPDATE rifas SET estado = 'cerrada', sorteo_id = ?, actualizado_en = ? WHERE id = ?").bind(creado.id, t, r.id),
    await eventoRifa(db, r.id, "cerrada", { sorteoId: creado.id, huella: creado.huella, ronda: creado.ronda, numerosPagados: lista.length, premios }),
  ]);
}

/** Si la ronda ya se emitió, completa el sorteo y marca la rifa como sorteada. */
async function finalizar(db: D1Database, r: RifaCierre): Promise<SorteoPublico | null> {
  const s = await resolverSorteo(db, r.sorteo_id!);
  if (s?.estado !== "resuelto") return s;
  const cambio = await db.prepare("UPDATE rifas SET estado = 'sorteada', actualizado_en = ? WHERE id = ? AND estado = 'cerrada' RETURNING id")
    .bind(ahora(), r.id).first();
  if (cambio) {
    await (await eventoRifa(db, r.id, "sorteada", { sorteoId: s.id, ganadores: s.ganadores.map((g) => g.nombre) })).run();
  }
  return s;
}

/** Avanza una rifa según la hora: la cierra, sortea o no hace nada. */
export async function avanzarRifa(db: D1Database, rifaId: string): Promise<void> {
  const r = await db.prepare("SELECT id, titulo, premios, estado, cierre_en, sorteo_id FROM rifas WHERE id = ?").bind(rifaId).first<RifaCierre>();
  if (!r) return;
  if ((r.estado === "abierta" && r.cierre_en <= ahora()) || r.estado === "cerrando") await cerrar(db, r);
  const actual = r.estado === "cerrada" ? r : await db.prepare("SELECT id, titulo, premios, estado, cierre_en, sorteo_id FROM rifas WHERE id = ?").bind(rifaId).first<RifaCierre>();
  if (actual?.estado === "cerrada" && actual.sorteo_id) await finalizar(db, actual);
}

/** Cron: cierra las rifas vencidas y completa los sorteos pendientes. */
export async function procesarCierres(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT id FROM rifas WHERE (estado = 'abierta' AND cierre_en <= ?) OR estado = 'cerrando'
       OR (estado = 'cerrada' AND sorteo_id IS NOT NULL) LIMIT 50`,
  ).bind(ahora()).all<{ id: string }>();
  for (const { id } of results) await avanzarRifa(db, id);
}
