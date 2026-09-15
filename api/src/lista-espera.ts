import { Hono } from "hono";
import { z } from "zod";

export const esquemaListaEspera = z.object({
  email: z.string().trim().toLowerCase().email("Revisa el correo: no parece válido").max(120),
  tipo: z.enum(["bomberos", "colegio", "club", "fundacion", "junta", "persona", "otro"], { message: "Elige quién organiza" }),
  numeros: z.enum(["100", "500", "2000", "mas"], { message: "Elige el tamaño de tu rifa" }),
  pagaria: z.enum(["si", "tal-vez", "no"], { message: "Responde si pagarías" }),
  origen: z.string().trim().max(80).optional(),
  /** Campo trampa: las personas no lo ven; los bots lo llenan. */
  sitio: z.string().max(0).optional(),
});

export const listaEspera = new Hono<{ Bindings: CloudflareBindings }>();

listaEspera.post("/", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const { success } = await c.env.LIMITE_FORMULARIOS.limit({ key: ip });
  if (!success) return c.json({ error: "Demasiados intentos. Espera un minuto." }, 429);

  const datos = esquemaListaEspera.safeParse(await c.req.json().catch(() => null));
  // Al bot que llenó el campo trampa se le responde igual que a una persona.
  if (!datos.success && datos.error.issues.some((i) => i.path[0] === "sitio")) return c.json({ ok: true }, 201);
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);

  const { email, tipo, numeros, pagaria, origen } = datos.data;
  const ahora = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO lista_espera (email, tipo, numeros, pagaria, origen, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET tipo = excluded.tipo, numeros = excluded.numeros,
       pagaria = excluded.pagaria, actualizado_en = excluded.actualizado_en`,
  )
    .bind(email, tipo, numeros, pagaria, origen ?? null, ahora, ahora)
    .run();
  return c.json({ ok: true }, 201);
});
