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
  azar: string | null;
  firma: string | null;
  ganador: string | null;
  creado_en: number;
  resuelto_en: number | null;
}

const ahora = () => Math.floor(Date.now() / 1000);

function publico(f: Fila): SorteoPublico {
  const lista: string[] = JSON.parse(f.lista);
  return {
    id: f.id,
    tipo: f.tipo,
    titulo: f.titulo,
    lista,
    huella: f.huella,
    ronda: f.ronda,
    momento: momentoRonda(f.ronda),
    estado: f.azar ? "resuelto" : "pendiente",
    azar: f.azar,
    firma: f.firma,
    ganador: f.ganador ? { linea: f.ganador, indice: lista.indexOf(f.ganador), nombre: nombreDe(f.ganador) } : null,
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
    const { ganadores } = await sortear({ azar: r.azar, rifaId: f.id, lista: JSON.parse(f.lista), premios: 1 });
    const ganador = ganadores[0]!.linea;
    const resuelto = ahora();
    await db
      .prepare("UPDATE sorteos SET azar = ?, firma = ?, ganador = ?, resuelto_en = ? WHERE id = ? AND azar IS NULL")
      .bind(r.azar, r.firma, ganador, resuelto, f.id)
      .run();
    return { ...f, azar: r.azar, firma: r.firma, ganador, resuelto_en: resuelto };
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

  const lista = lineasDe(datos.data.nombres);
  const huella = await sha256(lista.join("\n"));
  // La ronda se fija con el reloj del servidor y es siempre futura.
  const ronda = rondaDrand(Date.now() / 1000) + 1;
  const id = generarId();
  await c.env.DB.prepare(
    "INSERT INTO sorteos (id, tipo, titulo, lista, huella, ronda, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, datos.data.tipo, datos.data.titulo || null, JSON.stringify(lista), huella, ronda, ahora())
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
