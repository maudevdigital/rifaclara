// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://rifaclara.maudev.cl",
  // URLs sin barra final (/ruleta), iguales a las canónicas.
  trailingSlash: "never",
  build: { format: "file" },
  adapter: cloudflare(),
  vite: { plugins: [tailwindcss()] },
  // La portada queda fuera del sitemap mientras sea provisoria (noindex).
  integrations: [sitemap({ filter: (pagina) => pagina !== "https://rifaclara.maudev.cl/" })],
});