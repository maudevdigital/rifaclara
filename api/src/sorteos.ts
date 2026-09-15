import { Hono } from "hono";
import { leerRonda, momentoRonda, RondaNoDisponible, rondaDrand, sha256, sortear } from "@rifaclara/shared";
import type { SorteoCreado, SorteoPublico } from "@rifaclara/shared";
import { esquemaNuevoSorteo, generarId, lineasDe, nombreDe } from "./lista";

interface Fila {
  id: string;
  tipo: string;
  titulo: string | null;
  lista: string;
  huella: string;
  ronda: number;
  premios: number;
  azar: string | null;
  firma: string | null;
  ganador: string | null;
  ganadores: string | null;
  creado_en: number;
  resuelto_en: number | null;
}

const ahora = () => Math.floor(Date.now() / 1000);

function publico(f: Fila): SorteoPublico {
  const lista: string[] = JSON.parse(f.lista);
  // Los sorteos anteriores a la migración 0002 solo tienen `ganador`.
  const lineas: string[] = f.ganadores ? JSON.parse(f.ganadores) : f.ganador ? [f.ganador] : [];
  const ganadores = lineas.map((linea, premio) => ({ premio, linea, indice: lista.indexOf(linea), nombre: nombreDe(linea, f.tipo) }));
  return {
    id: f.id,
    tipo: f.tipo,
    titulo: f.titulo,
    lista,
    huella: f.huella,
    ronda: f.ronda,
    momento: momentoRonda(f.ronda),
    premios: f.premios,
    estado: f.azar ? "resuelto" : "pendiente",
    azar: f.azar,
    firma: f.firma,
    ganador: ganadores[0] ?? null,
    ganadores,
    creadoEn: f.creado_en,
    resueltoEn: f.resuelto_en,
  };
}

/**
 * Completa el sorteo si su ronda ya se emitió. Es idempotente: el resultado es
 * determinista y el UPDATE solo escribe si todavía no hay azar guardado.
 */
async function resolver(db: D1Database, f: Fila): Promise<Fila> {
  if (f.azar || ahora() < momentoRonda(f.ronda)) return f;
  try {
    const r = await leerRonda(f.ronda, { intentos: 1, esperar: async () => {} });
    const res = await sortear({ azar: r.azar, rifaId: f.id, lista: JSON.parse(f.lista), premios: f.premios });
    const lineas = res.ganadores.map((g) => g.linea);
    const resuelto = ahora();
    await db
      .prepare("UPDATE sorteos SET azar = ?, firma = ?, ganador = ?, ganadores = ?, resuelto_en = ? WHERE id = ? AND azar IS NULL")
      .bind(r.azar, r.firma, lineas[0], JSON.stringify(lineas), resuelto, f.id)
      .run();
    return { ...f, azar: r.azar, firma: r.firma, ganador: lineas[0]!, ganadores: JSON.stringify(lineas), resuelto_en: resuelto };
  } catch (e) {
    if (e instanceof RondaNoDisponible) return f;
    throw e;
  }
}

export const sorteos = new Hono<{ Bindings: CloudflareBindings }>();

sorteos.post("/", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const { success } = await c.env.LIMITE_SORTEOS.limit({ key: ip });
  if (!success) return c.json({ error: "Demasiados sorteos seguidos. Espera un minuto y vuelve a intentar." }, 429);

  const cuerpo = await c.req.json().catch(() => null);
  const datos = esquemaNuevoSorteo.safeParse(cuerpo);
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);

  const { tipo, premios, titulo } = datos.data;
  const lista = lineasDe(datos.data);
  const huella = await sha256(lista.join("\n"));
  // La ronda se fija con el reloj del servidor y es siempre futura.
  const ronda = rondaDrand(Date.now() / 1000) + 1;
  const id = generarId();
  await c.env.DB.prepare(
    "INSERT INTO sorteos (id, tipo, titulo, lista, huella, ronda, premios, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, tipo, titulo || null, JSON.stringify(lista), huella, ronda, premios, ahora())
    .run();
  return c.json({ id, huella, ronda, momento: momentoRonda(ronda) } satisfies SorteoCreado, 201);
});

sorteos.get("/:id", async (c) => {
  const fila = await c.env.DB.prepare("SELECT * FROM sorteos WHERE id = ?").bind(c.req.param("id")).first<Fila>();
  if (!fila) return c.json({ error: "No existe ese sorteo o ya se borró (se guardan 90 días)" }, 404);
  const f = await resolver(c.env.DB, fila);
  return c.json(publico(f), 200, { "cache-control": f.azar ? "public, max-age=300" : "no-store" });
});

/** Borra sorteos de más de 90 días (Ley 21.719: no guardar más de lo necesario). */
export async function borrarAntiguos(db: D1Database) {
  await db.prepare("DELETE FROM sorteos WHERE creado_en < ?").bind(ahora() - 90 * 86400).run();
}
