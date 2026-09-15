import { DRAND_QUICKNET, momentoRonda } from "./sorteo";

/** Dos relays independientes; se exige que respondan lo mismo. */
export const RELAYS_DRAND = ["https://api.drand.sh", "https://drand.cloudflare.com"] as const;

export interface RondaDrand {
  ronda: number;
  /** sha256 de la firma, 64 caracteres hexadecimales. */
  azar: string;
  /** Firma BLS de la ronda, en hexadecimal. */
  firma: string;
}

export class RondaNoDisponible extends Error {}

function hexABytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) throw new Error("Hexadecimal inválido");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * En quicknet el azar es sha256(firma). Comprobarlo es barato y asegura que el
 * relay no inventó el valor; la verificación BLS completa de la firma contra
 * la clave pública de drand se agrega aparte.
 */
export async function azarCoincideConFirma({ azar, firma }: RondaDrand): Promise<boolean> {
  return (await sha256Hex(hexABytes(firma))) === azar;
}

async function leerDeRelay(relay: string, ronda: number, f: typeof fetch): Promise<RondaDrand> {
  const res = await f(`${relay}/${DRAND_QUICKNET.chainHash}/public/${ronda}`);
  if (res.status === 425) throw new RondaNoDisponible(`La ronda ${ronda} todavía no se emite`);
  if (!res.ok) throw new Error(`${relay} respondió ${res.status}`);
  const d = (await res.json()) as { round: number; randomness: string; signature: string };
  return { ronda: d.round, azar: d.randomness, firma: d.signature };
}

/**
 * Lee una ronda desde todos los relays y exige que coincidan. Si la ronda aún
 * no existe, espera hasta su hora y reintenta, hasta `intentos` veces.
 */
export async function leerRonda(
  ronda: number,
  { f = fetch, intentos = 5, esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<RondaDrand> {
  for (let intento = 1; ; intento++) {
    const faltaMs = momentoRonda(ronda) * 1000 - Date.now();
    if (faltaMs > 0) await esperar(faltaMs + 400);
    try {
      const lecturas = await Promise.all(RELAYS_DRAND.map((r) => leerDeRelay(r, ronda, f)));
      const [primera] = lecturas;
      if (lecturas.some((l) => l.ronda !== ronda || l.azar !== primera!.azar || l.firma !== primera!.firma)) {
        throw new Error("Los relays de drand no coinciden");
      }
      if (!(await azarCoincideConFirma(primera!))) throw new Error("El azar no corresponde a la firma");
      return primera!;
    } catch (e) {
      if (!(e instanceof RondaNoDisponible) || intento >= intentos) throw e;
      await esperar(1000);
    }
  }
}
