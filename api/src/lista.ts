import { z } from "zod";
import { formatearNumero } from "@rifaclara/shared";

export const MAX_NOMBRES = 500;
export const MAX_LARGO = 80;

export const esquemaNuevoSorteo = z.object({
  nombres: z
    .array(z.string().trim().min(1, "Hay una línea vacía").max(MAX_LARGO, `Cada nombre puede tener hasta ${MAX_LARGO} caracteres`))
    .min(2, "Se necesitan al menos dos nombres")
    .max(MAX_NOMBRES, `Se aceptan hasta ${MAX_NOMBRES} nombres`),
  titulo: z.string().trim().max(MAX_LARGO).optional(),
  tipo: z.enum(["ruleta", "nombres"]).default("ruleta"),
});

/** Líneas públicas en el orden recibido: "0:Camila", "1:Benjamín"… */
export function lineasDe(nombres: string[]): string[] {
  return nombres.map((nombre, i) => `${formatearNumero(i, nombres.length)}:${nombre}`);
}

/** Nombre de una línea "07:Camila" → "Camila". */
export function nombreDe(linea: string): string {
  return linea.slice(linea.indexOf(":") + 1);
}

// Sin 0/o, 1/l/i para que el id se pueda dictar sin confusiones.
const ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz";

export function generarId(largo = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  // 248 es el mayor múltiplo de 31 bajo 256: se descarta lo que sesgaría.
  let id = "";
  for (const b of bytes) if (b < 248) id += ALFABETO[b % ALFABETO.length];
  return id.length === largo ? id : id + generarId(largo - id.length);
}
