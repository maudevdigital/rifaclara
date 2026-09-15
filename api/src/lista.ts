import { z } from "zod";
import { formatearNumero } from "@rifaclara/shared";

export const MAX_NOMBRES = 500;
export const MAX_NUMEROS = 10000;
export const MAX_PREMIOS = 20;
export const MAX_LARGO = 80;

const nombre = z.string().trim().min(1, "Hay una línea vacía").max(MAX_LARGO, `Cada nombre puede tener hasta ${MAX_LARGO} caracteres`);

export const esquemaNuevoSorteo = z
  .object({
    tipo: z.enum(["ruleta", "nombres", "rifa"]).default("ruleta"),
    nombres: z.array(nombre).min(2, "Se necesitan al menos dos participantes").max(MAX_NUMEROS),
    premios: z.number().int().min(1, "Debe haber al menos un premio").max(MAX_PREMIOS, `Se sortean hasta ${MAX_PREMIOS} premios`).default(1),
    titulo: z.string().trim().max(MAX_LARGO).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tipo !== "rifa" && d.nombres.length > MAX_NOMBRES) {
      ctx.addIssue({ code: "custom", message: `Se aceptan hasta ${MAX_NOMBRES} nombres` });
    }
    if (d.tipo === "rifa") {
      if (d.nombres.some((n) => !/^\d{1,5}$/.test(n))) ctx.addIssue({ code: "custom", message: "En una rifa cada línea debe ser un número" });
      if (new Set(d.nombres).size !== d.nombres.length) ctx.addIssue({ code: "custom", message: "Hay números repetidos" });
    }
    if (d.premios >= d.nombres.length) {
      ctx.addIssue({ code: "custom", message: "Tiene que haber más participantes que premios" });
    }
  });

export type NuevoSorteo = z.infer<typeof esquemaNuevoSorteo>;

/**
 * Líneas públicas en el orden recibido. En una rifa cada línea es el número
 * ("047"); en ruleta y nombres se numeran para admitir repetidos ("0:Camila").
 */
export function lineasDe({ tipo, nombres }: Pick<NuevoSorteo, "tipo" | "nombres">): string[] {
  if (tipo === "rifa") return nombres;
  return nombres.map((n, i) => `${formatearNumero(i, nombres.length)}:${n}`);
}

/**
 * Lo que se muestra de una línea: "07:Camila" → "Camila". En el sorteo de rifa
 * la línea es el número; en las rifas de la plataforma, "047:huella" → "047".
 */
export function nombreDe(linea: string, tipo = "ruleta"): string {
  if (tipo === "rifa") return linea;
  if (tipo === "plataforma") return linea.slice(0, linea.indexOf(":"));
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
