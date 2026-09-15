import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { sha256 } from "@rifaclara/shared";
import { enviarCorreo } from "./correo";
import { generarId } from "./lista";

export interface Usuario {
  id: string;
  email: string;
  nombre: string | null;
  alias: string;
}
export type Entorno = { Bindings: CloudflareBindings; Variables: { usuario: Usuario | null } };

const COOKIE = "rc_sesion";
const DURACION_SESION = 30 * 86400;
const DURACION_ENLACE = 15 * 60;
const ahora = () => Math.floor(Date.now() / 1000);

/** Texto aleatorio para tokens e ids de sesión: 32 bytes en base64url. */
export function aleatorio(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Las peticiones que cambian datos con la cookie de sesión deben venir del
 * propio sitio. SameSite=Lax ya lo cubre en navegadores modernos; esto es la
 * segunda capa.
 */
function origenValido(c: Context<Entorno>): boolean {
  if (c.req.method === "GET" || c.req.method === "HEAD") return true;
  const origen = c.req.header("origin");
  return !origen || origen === new URL(c.env.SITIO).origin;
}

/** Carga el usuario de la cookie, si hay. No exige sesión. */
export const conSesion: MiddlewareHandler<Entorno> = async (c, next) => {
  c.set("usuario", null);
  const id = getCookie(c, COOKIE);
  if (id) {
    const usuario = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.nombre, u.alias FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.id_hash = ? AND s.vence_en > ?`,
    ).bind(await sha256(id), ahora()).first<Usuario>();
    c.set("usuario", usuario ?? null);
  }
  await next();
};

export const requiereUsuario: MiddlewareHandler<Entorno> = async (c, next) => {
  if (!c.get("usuario")) return c.json({ error: "Tienes que ingresar para hacer esto." }, 401);
  if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
  await next();
};

const esquemaEnlace = z.object({ email: z.string().trim().toLowerCase().email("Revisa el correo: no parece válido").max(120) });

export const auth = new Hono<Entorno>();

auth.post("/enlace", async (c) => {
  const datos = esquemaEnlace.safeParse(await c.req.json().catch(() => null));
  if (!datos.success) return c.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const { email } = datos.data;
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const [porIp, porEmail] = await Promise.all([
    c.env.LIMITE_FORMULARIOS.limit({ key: `enlace:${ip}` }),
    c.env.LIMITE_FORMULARIOS.limit({ key: `enlace:${email}` }),
  ]);
  if (!porIp.success || !porEmail.success) return c.json({ error: "Pediste varios enlaces seguidos. Espera un minuto." }, 429);

  const token = aleatorio();
  await c.env.DB.prepare("INSERT INTO enlaces_ingreso (token_hash, email, vence_en, creado_en) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), email, ahora() + DURACION_ENLACE, ahora())
    .run();
  const enlace = `${c.env.SITIO}/ingresar/verificar?token=${token}`;

  if (c.env.ENTORNO === "local" || !c.env.RESEND_API_KEY) {
    console.log(`Enlace de ingreso para ${email}: ${enlace}`);
    return c.json({ ok: true, enlaceLocal: enlace });
  }
  const enviado = await enviarCorreo(c.env, {
    para: email,
    asunto: "Tu enlace para entrar a Rifa Clara",
    texto: `Entra a Rifa Clara con este enlace (vence en 15 minutos):\n\n${enlace}\n\nSi no lo pediste, ignora este correo.`,
    html: `<p>Hola:</p><p>Usa este botón para entrar a Rifa Clara. Vence en 15 minutos y sirve una sola vez.</p>
<p><a href="${enlace}" style="display:inline-block;background:#1D6359;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Entrar a Rifa Clara</a></p>
<p style="color:#57645F;font-size:13px">Si no pediste este correo, ignóralo: nadie puede entrar sin este enlace.</p>`,
  });
  if (!enviado) return c.json({ error: "No pudimos enviar el correo. Intenta de nuevo en unos minutos." }, 502);
  return c.json({ ok: true });
});

auth.post("/verificar", async (c) => {
  if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
  const token = z.object({ token: z.string().min(20).max(100) }).safeParse(await c.req.json().catch(() => null));
  if (!token.success) return c.json({ error: "El enlace está incompleto. Pide uno nuevo." }, 400);

  const hash = await sha256(token.data.token);
  // El UPDATE condicionado hace que el enlace sirva una sola vez aunque lleguen dos clics juntos.
  const usado = await c.env.DB.prepare(
    "UPDATE enlaces_ingreso SET usado_en = ? WHERE token_hash = ? AND usado_en IS NULL AND vence_en > ? RETURNING email",
  ).bind(ahora(), hash, ahora()).first<{ email: string }>();
  if (!usado) return c.json({ error: "El enlace venció o ya se usó. Pide uno nuevo." }, 400);

  const usuario = await c.env.DB.prepare(
    `INSERT INTO usuarios (id, email, alias, creado_en, ultimo_ingreso) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET ultimo_ingreso = excluded.ultimo_ingreso
     RETURNING id`,
  ).bind(crypto.randomUUID(), usado.email, generarId(8), ahora(), ahora()).first<{ id: string }>();

  const sesion = aleatorio();
  await c.env.DB.prepare("INSERT INTO sesiones (id_hash, usuario_id, vence_en, creado_en) VALUES (?, ?, ?, ?)")
    .bind(await sha256(sesion), usuario!.id, ahora() + DURACION_SESION, ahora())
    .run();
  setCookie(c, COOKIE, sesion, {
    httpOnly: true,
    secure: c.env.SITIO.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: DURACION_SESION,
  });
  return c.json({ ok: true });
});

auth.post("/salir", async (c) => {
  const id = getCookie(c, COOKIE);
  if (id) await c.env.DB.prepare("DELETE FROM sesiones WHERE id_hash = ?").bind(await sha256(id)).run();
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

/** Borra enlaces y sesiones vencidos (cron diario). */
export async function limpiarAuth(db: D1Database) {
  await db.batch([
    db.prepare("DELETE FROM enlaces_ingreso WHERE vence_en < ?").bind(ahora() - 86400),
    db.prepare("DELETE FROM sesiones WHERE vence_en < ?").bind(ahora()),
  ]);
}
