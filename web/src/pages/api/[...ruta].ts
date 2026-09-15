import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Mismo dominio para front y back: las cookies funcionan sin CORS.
export const ALL: APIRoute = ({ request }) => env.API.fetch(request);
