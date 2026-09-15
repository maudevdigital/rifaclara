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
  // Las páginas estáticas no usan bindings: prerenderizar con Node evita
  // depender de un workerd local, que en Windows a veces no levanta.
  adapter: cloudflare({ prerenderEnvironment: "node" }),
  vite: { plugins: [tailwindcss()] },
  // Fuera del sitemap: la portada provisoria, el ingreso y el panel (todas noindex).
  integrations: [
    sitemap({
      filter: (pagina) => pagina !== "https://rifaclara.maudev.cl/" && !/^\/(ingresar|panel)(\/|$)/.test(new URL(pagina).pathname),
    }),
  ],
});