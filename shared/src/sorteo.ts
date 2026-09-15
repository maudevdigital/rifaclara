/**
 * Sorteo verificable. El mismo código corre en la API (para sortear) y en el
 * navegador (para que cualquiera recalcule el resultado), así que no puede
 * depender de nada propio de Node ni de Workers: solo Web Crypto.
 *
 * Especificación (no cambiarla sin versionar: los sorteos pasados deben seguir
 * verificándose igual):
 *   huella   = sha256(lista.join("\n"))
 *   premio p = sha256(`${azar}:${rifaId}:${huella}:${p}`) como entero, mod quedan
 *   Cada ganador sale de la lista antes de sortear el premio siguiente.
 */

/** Red quicknet de drand: una ronda cada 3 segundos. */
export const DRAND_QUICKNET = {
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  genesis: 1692803367,
  periodo: 3,
} as const;

/** Primera ronda de drand emitida en el instante `segundos` o después. */
export function rondaDrand(segundos: number): number {
  const { genesis, periodo } = DRAND_QUICKNET;
  if (segundos <= genesis) return 1;
  return Math.ceil((segundos - genesis) / periodo) + 1;
}

/** Instante (segundos Unix) en que se emite una ronda. */
export function momentoRonda(ronda: number): number {
  const { genesis, periodo } = DRAND_QUICKNET;
  return genesis + (ronda - 1) * periodo;
}

export async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Número con ceros a la izquierda según el total: 7 de 100 → "07". */
export function formatearNumero(numero: number, total: number): string {
  return String(numero).padStart(String(total - 1).length, "0");
}

/** Línea pública de un boleto pagado: el número y la huella de su código. */
export async function lineaBoleto(numero: string, codigoBoleto: string): Promise<string> {
  return `${numero}:${await sha256(codigoBoleto)}`;
}

export interface EntradaSorteo {
  /** Valor aleatorio de la ronda de drand, 64 caracteres hexadecimales. */
  azar: string;
  rifaId: string;
  /** Líneas de la lista congelada, en el orden publicado. */
  lista: string[];
  premios: number;
}

export interface Ganador {
  premio: number;
  /** Posición en la lista que quedaba al sortear este premio. */
  indice: number;
  linea: string;
}

export interface ResultadoSorteo {
  huella: string;
  ganadores: Ganador[];
}

export async function sortear({ azar, rifaId, lista, premios }: EntradaSorteo): Promise<ResultadoSorteo> {
  if (!/^[0-9a-f]{64}$/.test(azar)) throw new Error("El azar debe tener 64 caracteres hexadecimales en minúscula");
  if (!rifaId) throw new Error("Falta el id de la rifa");
  if (!Number.isInteger(premios) || premios < 1) throw new Error("Debe haber al menos un premio");
  if (premios > lista.length) throw new Error(`Hay ${premios} premios y solo ${lista.length} boletos`);
  if (new Set(lista).size !== lista.length) throw new Error("La lista tiene líneas repetidas");

  const huella = await sha256(lista.join("\n"));
  const quedan = [...lista];
  const ganadores: Ganador[] = [];
  for (let premio = 0; premio < premios; premio++) {
    const h = await sha256(`${azar}:${rifaId}:${huella}:${premio}`);
    const indice = Number(BigInt("0x" + h) % BigInt(quedan.length));
    const [linea] = quedan.splice(indice, 1);
    ganadores.push({ premio, indice, linea: linea! });
  }
  return { huella, ganadores };
}
