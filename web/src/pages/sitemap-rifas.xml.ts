import type { APIRoute } from "astro";
import { apiServidor } from "../lib/api-servidor";

export const prerender = false;

/**
 * Sitemap de las rifas públicas. Es dinámico (las rifas cambian a cada rato);
 * el sitemap-index que genera @astrojs/sitemap lo incluye con customSitemaps.
 */
export const GET: APIRoute = async ({ request, site }) => {
  const { datos } = await apiServidor<{ rifas: { slug: string; actualizadoEn: number }[] }>(request, "/api/rifas/indexables");
  const urls = (datos?.rifas ?? [])
    .map((r) => `<url><loc>${new URL(`/r/${r.slug}`, site)}</loc><lastmod>${new Date(r.actualizadoEn * 1000).toISOString()}</lastmod></url>`)
    .join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
