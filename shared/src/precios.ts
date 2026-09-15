/**
 * Precio de una rifa según su cantidad de números. Pago único, en CLP y sin
 * comisión. Es la única fuente: la usan la API (para cobrar) y la web (para
 * mostrar). Referencia de mercado en docs/competencia.md.
 */
export const TRAMOS = [
  { id: "gratis", hasta: 100, precio: 0 },
  { id: "hasta-500", hasta: 500, precio: 4990 },
  { id: "hasta-2000", hasta: 2000, precio: 11990 },
] as const;

export type Tramo = (typeof TRAMOS)[number];

export const MAX_NUMEROS_RIFA = TRAMOS[TRAMOS.length - 1]!.hasta;

/** Tramo que corresponde a una rifa de `cantidad` números, o null si supera el máximo. */
export function tramoPara(cantidad: number): Tramo | null {
  return TRAMOS.find((t) => cantidad <= t.hasta) ?? null;
}
