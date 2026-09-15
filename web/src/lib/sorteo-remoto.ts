import { azarCoincideConFirma, sha256, sortear } from "@rifaclara/shared";
import type { SorteoCreado, SorteoPublico } from "@rifaclara/shared";

async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ruta, init);
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? `la API respondió ${res.status}`);
  return datos as T;
}

/**
 * Registra el sorteo en la API: la lista, su huella y una ronda futura de
 * drand quedan guardadas antes de que exista el azar.
 */
export function crearSorteo(datos: { tipo: "ruleta" | "nombres" | "rifa"; nombres: string[]; premios?: number; titulo?: string }) {
  return api<SorteoCreado>("/api/sorteos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(datos),
  });
}

export async function esperarResultado({ id, momento }: SorteoCreado): Promise<SorteoPublico> {
  const falta = momento * 1000 - Date.now() + 600;
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  for (let intento = 0; intento < 15; intento++) {
    const s = await api<SorteoPublico>(`/api/sorteos/${id}`);
    if (s.estado === "resuelto") return s;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("drand tardó más de lo normal");
}

/** No se confía a ciegas en el servidor: el navegador rehace todo el cálculo. */
export async function comprobarLocal(s: SorteoPublico, lista: string[]) {
  const ok =
    s.azar && s.firma &&
    s.lista.join("\n") === lista.join("\n") &&
    (await sha256(lista.join("\n"))) === s.huella &&
    (await azarCoincideConFirma({ ronda: s.ronda, azar: s.azar, firma: s.firma })) &&
    (await sortear({ azar: s.azar, rifaId: s.id, lista, premios: s.premios })).ganadores
      .map((g) => g.linea).join("\n") === s.ganadores.map((g) => g.linea).join("\n");
  if (!ok) throw new Error("el resultado del servidor no coincide con el cálculo de tu navegador");
}

export const enlaceSorteo = (id: string) => new URL(`/sorteo/${id}`, location.origin).href;

/** "1er premio", "2º premio", "3er premio"… */
export function nombrePremio(indice: number): string {
  const n = indice + 1;
  return `${n}${n === 1 || n === 3 ? "er" : "º"} premio`;
}
