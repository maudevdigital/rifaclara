// Registro público de una rifa: todo lo que pasó, en orden y encadenado por
// hash. Cuando la rifa termina, ese registro se guarda tal cual y su huella se
// sella con OpenTimestamps, que la ancla en la cadena de Bitcoin. Desde ahí la
// fecha ya no depende de nosotros: cualquiera la comprueba por su cuenta.
import { resolverSorteo } from "./sorteos";
import { aHex, digestDe, sellar } from "./ots";

const ahora = () => Math.floor(Date.now() / 1000);

export const claveRegistro = (rifaId: string) => `rifas/${rifaId}/registro.json`;
export const claveSello = (rifaId: string) => `rifas/${rifaId}/registro.ots`;

export interface EventoRegistro {
  id: number;
  tipo: string;
  datos: string | null;
  hashAnterior: string | null;
  hash: string;
  creadoEn: number;
}

/** Los eventos de una rifa, en el orden en que ocurrieron. */
export async function eventosDe(db: D1Database, rifaId: string): Promise<EventoRegistro[]> {
  const { results } = await db.prepare(
    `SELECT id, tipo, datos, hash_anterior AS hashAnterior, hash, creado_en AS creadoEn
     FROM eventos WHERE rifa_id = ? ORDER BY id`,
  ).bind(rifaId).all<EventoRegistro>();
  return results;
}

interface FilaRifa {
  id: string; slug: string; titulo: string; descripcion: string | null; premios: string; precio: number;
  desde: number; hasta: number; cierre_en: number; zona_horaria: string; estado: string;
  sorteo_id: string | null; creado_en: number;
}

/**
 * Arma el archivo del registro. Se guarda con estos mismos bytes, porque es de
 * ellos que sale la huella sellada: cambiar una coma la invalidaría.
 */
export async function construirRegistro(db: D1Database, rifaId: string, sitio: string): Promise<string | null> {
  const r = await db.prepare(
    `SELECT id, slug, titulo, descripcion, premios, precio, desde, hasta, cierre_en, zona_horaria, estado, sorteo_id, creado_en
     FROM rifas WHERE id = ?`,
  ).bind(rifaId).first<FilaRifa>();
  if (!r) return null;
  const sorteo = r.sorteo_id ? await resolverSorteo(db, r.sorteo_id) : null;
  return JSON.stringify(
    {
      formato: "rifaclara-registro-1",
      sitio,
      rifa: {
        slug: r.slug,
        titulo: r.titulo,
        descripcion: r.descripcion,
        premios: JSON.parse(r.premios) as string[],
        precio: r.precio,
        desde: r.desde,
        hasta: r.hasta,
        cierreEn: r.cierre_en,
        zonaHoraria: r.zona_horaria,
        estado: r.estado,
        creadoEn: r.creado_en,
      },
      sorteo: sorteo && {
        id: sorteo.id,
        estado: sorteo.estado,
        huella: sorteo.huella,
        ronda: sorteo.ronda,
        momento: sorteo.momento,
        azar: sorteo.azar ?? null,
        premios: sorteo.premios,
        lista: sorteo.lista,
        ganadores: sorteo.ganadores,
      },
      eventos: await eventosDe(db, r.id),
      // Cómo se encadenan los eventos, para poder rehacer el cálculo sin leer el código.
      cadena: 'hash = sha256("hashAnterior|tipo|datos|creadoEn"), con hashAnterior vacío en el primero',
      generadoEn: ahora(),
    },
    null,
    2,
  );
}

/** Una rifa terminada: ya no le pasan más cosas, así que su registro se puede cerrar. */
const TERMINADAS = "(estado = 'sorteada' OR (estado = 'cerrada' AND sorteo_id IS NULL))";

/**
 * Guarda el registro de una rifa terminada y sella su huella. Si los
 * calendarios no responden, la deja pendiente para la próxima pasada del cron.
 */
export async function sellarRifa(env: CloudflareBindings, rifaId: string): Promise<boolean> {
  const json = await construirRegistro(env.DB, rifaId, env.SITIO);
  if (!json) return false;
  const bytes = new TextEncoder().encode(json);
  const digest = await digestDe(bytes);
  let sello: { archivo: Uint8Array; calendarios: string[] };
  try {
    sello = await sellar(digest);
  } catch (e) {
    console.error("No se pudo sellar la rifa", rifaId, e);
    await env.DB.prepare("UPDATE rifas SET sello_estado = 'pendiente' WHERE id = ?").bind(rifaId).run();
    return false;
  }
  await env.FOTOS.put(claveRegistro(rifaId), bytes, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  await env.FOTOS.put(claveSello(rifaId), sello.archivo, { httpMetadata: { contentType: "application/octet-stream" } });
  await env.DB.prepare(
    "UPDATE rifas SET sello_estado = 'sellado', sello_en = ?, sello_huella = ?, sello_calendarios = ? WHERE id = ?",
  ).bind(ahora(), aHex(digest), JSON.stringify(sello.calendarios), rifaId).run();
  return true;
}

/** Cron: sella las rifas que terminaron y todavía no tienen comprobante. */
export async function procesarSellos(env: CloudflareBindings, limite = 3) {
  const { results } = await env.DB.prepare(
    `SELECT id FROM rifas WHERE ${TERMINADAS} AND (sello_estado IS NULL OR sello_estado = 'pendiente')
     ORDER BY actualizado_en LIMIT ?`,
  ).bind(limite).all<{ id: string }>();
  for (const { id } of results) await sellarRifa(env, id);
}
