import { env } from "cloudflare:workers";

/**
 * Llama a la API desde una página renderizada en el servidor, reenviando la
 * cookie de sesión del visitante. Va por el service binding: no sale a internet.
 */
export async function apiServidor<T>(peticion: Request, ruta: string): Promise<{ estado: number; datos: T | null }> {
  const res = await env.API.fetch(
    new Request(new URL(ruta, peticion.url), { headers: { cookie: peticion.headers.get("cookie") ?? "" } }),
  );
  return { estado: res.status, datos: res.ok ? ((await res.json()) as T) : null };
}
