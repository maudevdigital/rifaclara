import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const guias = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guias" }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string().max(160),
    publicado: z.coerce.date(),
    actualizado: z.coerce.date().optional(),
    /** Herramienta que se recomienda al final de la guía. */
    herramienta: z.enum(["ruleta", "sorteo-de-rifa"]).optional(),
    orden: z.number().default(99),
  }),
});

export const collections = { guias };
