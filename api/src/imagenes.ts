import { Hono } from "hono";
import type { Entorno } from "./auth";
import { requiereUsuario } from "./auth";
import { eventoRifa } from "./eventos";
import { generarId } from "./lista";

/** Límites por tipo: la foto llega achicada desde el navegador; la tarjeta es de 1200×630. */
const LIMITES = { foto: 1_500_000, og: 700_000 } as const;
type TipoImagen = keyof typeof LIMITES;

/**
 * Tipo real de la imagen según sus primeros bytes (no se confía en la extensión
 * ni en el content-type que declara el navegador).
 */
export function detectarTipo(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const texto = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (texto(0, 4) === "RIFF" && texto(8, 4) === "WEBP") return "image/webp";
  return null;
}

const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export const imagenes = new Hono<Entorno>();

/**
 * Sube la foto del premio (?tipo=foto) o la tarjeta para compartir (?tipo=og)
 * de una rifa del organizador. El cuerpo es la imagen tal cual.
 */
imagenes.post("/:id", requiereUsuario, async (c) => {
  const tipo = c.req.query("tipo") as TipoImagen;
  if (!(tipo in LIMITES)) return c.json({ error: "Tipo de imagen desconocido." }, 400);
  const r = await c.env.DB.prepare("SELECT id, foto, og, estado FROM rifas WHERE id = ? AND usuario_id = ?")
    .bind(c.req.param("id"), c.get("usuario")!.id).first<{ id: string; foto: string | null; og: string | null; estado: string }>();
  if (!r) return c.json({ error: "No existe esa rifa en tu cuenta." }, 404);

  const declarado = Number(c.req.header("content-length") ?? 0);
  if (declarado > LIMITES[tipo]) return c.json({ error: "La imagen es demasiado pesada." }, 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length === 0) return c.json({ error: "No llegó ninguna imagen." }, 400);
  if (bytes.length > LIMITES[tipo]) return c.json({ error: "La imagen es demasiado pesada." }, 413);
  const contentType = detectarTipo(bytes);
  // WhatsApp y Facebook no siempre muestran WebP en la vista previa: la tarjeta va en JPEG o PNG.
  if (!contentType || (tipo === "og" && contentType === "image/webp")) {
    return c.json({ error: "El archivo no es una imagen válida (JPG, PNG o WebP)." }, 415);
  }

  // Clave nueva en cada subida: así la imagen se puede guardar en caché para siempre.
  const clave = `rifas/${r.id}/${tipo}-${generarId(8)}.${EXTENSION[contentType]}`;
  await c.env.FOTOS.put(clave, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  const anterior = r[tipo];
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE rifas SET ${tipo} = ?, actualizado_en = ? WHERE id = ?`).bind(clave, Math.floor(Date.now() / 1000), r.id),
    await eventoRifa(c.env.DB, r.id, tipo === "foto" ? "foto_actualizada" : "tarjeta_actualizada", { clave }),
  ]);
  if (anterior) await c.env.FOTOS.delete(anterior);
  return c.json({ url: `/fotos/${clave}` }, 201);
});
