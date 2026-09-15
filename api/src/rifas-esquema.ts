import { z } from "zod";

export const MIN_NUMEROS = 10;
export const MAX_NUMEROS_GRATIS = 100;

const telefono = z
  .string()
  .transform((t) => t.replace(/[\s()+-]/g, ""))
  .refine((t) => t === "" || /^\d{8,15}$/.test(t), "El WhatsApp debe tener entre 8 y 15 dígitos, con código de país");

export const esquemaNuevaRifa = z
  .object({
    titulo: z.string().trim().min(5, "El nombre de la rifa es muy corto").max(90, "El nombre puede tener hasta 90 caracteres"),
    descripcion: z.string().trim().max(600, "La descripción puede tener hasta 600 caracteres").default(""),
    premios: z
      .array(z.string().trim().min(2, "Describe cada premio").max(90))
      .min(1, "Agrega al menos un premio")
      .max(5, "Se pueden sortear hasta 5 premios"),
    precio: z.number().int().min(100, "El precio mínimo por número es $100").max(1_000_000, "El precio máximo por número es $1.000.000"),
    desde: z.number().int().min(0).max(99999),
    hasta: z.number().int().min(1).max(99999),
    mediosPago: z.string().trim().min(10, "Explica cómo te pagan, por ejemplo tus datos de transferencia").max(400),
    whatsapp: telefono.default(""),
    cierreEn: z.number().int(),
    horasReserva: z.number().int().min(1).max(72).default(24),
    maxPorPersona: z.number().int().min(1).max(50).default(10),
    declaracion: z.literal(true, { message: "Tienes que aceptar la declaración del organizador" }),
  })
  .superRefine((d, ctx) => {
    const problema = (message: string) => ctx.addIssue({ code: "custom", message });
    const total = d.hasta - d.desde + 1;
    if (d.hasta <= d.desde) problema("“Hasta” tiene que ser mayor que “desde”");
    else if (total < MIN_NUMEROS) problema(`La rifa debe tener al menos ${MIN_NUMEROS} números`);
    else if (total > MAX_NUMEROS_GRATIS) problema(`Por ahora las rifas llegan hasta ${MAX_NUMEROS_GRATIS} números`);
    else if (d.premios.length >= total) problema("Tiene que haber más números que premios");
    const ahora = Date.now() / 1000;
    if (d.cierreEn < ahora + 3600) problema("El cierre tiene que ser al menos en una hora más");
    else if (d.cierreEn > ahora + 180 * 86400) problema("El cierre puede ser como máximo en 6 meses");
  });

export type NuevaRifa = z.infer<typeof esquemaNuevaRifa>;

/** "Rifa Bomberos 3ª Compañía" → "rifa-bomberos-3a-compania" (el sufijo se agrega aparte). */
export function baseDeSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/ª/g, "a").replace(/º/g, "o")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, "") || "rifa";
}

/** Números de la rifa como texto con el mismo ancho: 1..100 → "001".."100". */
export function numerosDeRifa(desde: number, hasta: number): string[] {
  const ancho = String(hasta).length;
  return Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i).padStart(ancho, "0"));
}
