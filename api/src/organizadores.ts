import { Hono } from "hono";
import { z } from "zod";
import { requiereUsuario, type Entorno } from "./auth";

/** Alias público: lo genera el sistema, así que basta con validar la forma. */
const ALIAS = /^[a-z0-9]{4,16}$/;

export interface ResumenOrganizador {
  alias: string;
  nombre: string | null;
  desde: number;
  publicadas: number;
  sorteadas: number;
  canceladas: number;
}

/**
 * Historial de un organizador: cuántas rifas publicó y cuántas terminó
 * sorteando. Es lo que da confianza en la página de una rifa suya.
 */
export async function resumenOrganizador(db: D1Database, usuarioId: string): Promise<ResumenOrganizador | null> {
  const u = await db.prepare("SELECT alias, nombre, creado_en FROM usuarios WHERE id = ?")
    .bind(usuarioId).first<{ alias: string | null; nombre: string | null; creado_en: number }>();
  if (!u?.alias) return null;
  const n = await db.prepare(
    `SELECT COUNT(*) AS publicadas,
       COALESCE(SUM(estado = 'sorteada'), 0) AS sorteadas,
       COALESCE(SUM(estado = 'cancelada'), 0) AS canceladas
     FROM rifas WHERE usuario_id = ? AND visibilidad = 'publica' AND estado != 'pago_pendiente'`,
  ).bind(usuarioId).first<{ publicadas: number; sorteadas: number; canceladas: number }>();
  return { alias: u.alias, nombre: u.nombre, desde: u.creado_en, ...n! };
}

export const organizadores = new Hono<Entorno>();

/** Nombre con el que aparece en sus rifas. Vacío vuelve a dejarlo anónimo. */
organizadores.put("/yo", requiereUsuario, async (c) => {
  const datos = z.object({ nombre: z.string().trim().max(60, "El nombre puede tener hasta 60 caracteres") })
    .safeParse(await c.req.json().catch(() => null));
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const nombre = datos.data.nombre || null;
  if (nombre && nombre.length < 2) return c.json({ error: "El nombre es muy corto." }, 400);
  await c.env.DB.prepare("UPDATE usuarios SET nombre = ? WHERE id = ?").bind(nombre, c.get("usuario")!.id).run();
  return c.json({ ok: true, nombre });
});

/** Página pública del organizador: su historial y sus rifas. */
organizadores.get("/:alias", async (c) => {
  const alias = c.req.param("alias");
  if (!ALIAS.test(alias)) return c.json({ error: "No existe ese organizador" }, 404);
  const u = await c.env.DB.prepare("SELECT id FROM usuarios WHERE alias = ?").bind(alias).first<{ id: string }>();
  if (!u) return c.json({ error: "No existe ese organizador" }, 404);
  const resumen = (await resumenOrganizador(c.env.DB, u.id))!;
  const { results } = await c.env.DB.prepare(
    `SELECT slug, titulo, estado, cierre_en AS cierreEn, sorteo_id AS sorteoId, creado_en AS creadoEn
     FROM rifas WHERE usuario_id = ? AND visibilidad = 'publica' AND estado != 'pago_pendiente'
     ORDER BY creado_en DESC LIMIT 30`,
  ).bind(u.id).all();
  return c.json({ organizador: resumen, rifas: results });
});
