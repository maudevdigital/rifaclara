import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

/** Sirve las fotos y tarjetas de las rifas directo desde R2. Las claves no se reutilizan: caché para siempre. */
export const GET: APIRoute = async ({ params, request }) => {
  const clave = params.clave ?? "";
  if (!/^rifas\/[\w-]+\/(foto|og)-[a-z0-9]+\.(webp|jpg|png)$/.test(clave)) return new Response("No encontrada", { status: 404 });
  const objeto = await env.FOTOS.get(clave, { onlyIf: request.headers });
  if (!objeto) return new Response("No encontrada", { status: 404 });
  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  headers.set("etag", objeto.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Con If-None-Match que coincide, R2 devuelve el objeto sin cuerpo.
  if (!("body" in objeto)) return new Response(null, { status: 304, headers });
  return new Response(objeto.body, { headers });
};
