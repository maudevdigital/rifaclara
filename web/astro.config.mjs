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
  // Flow devuelve al organizador con un formulario POST desde flow.cl, que la
  // protección de Astro bloquearía. La API ya valida el origen en las
  // peticiones con sesión, y los pagos se confirman consultando a Flow.
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
  // Fuera del sitemap: el ingreso y el panel (noindex). Las rifas públicas van en
  // /sitemap-rifas.xml, que se genera en cada visita y se agrega al índice.
  integrations: [
    sitemap({
      filter: (pagina) => !/\/(ingresar|panel)(\/|$)/.test(new URL(pagina).pathname),
      customSitemaps: ["https://rifaclara.maudev.cl/sitemap-rifas.xml"],
    }),
  ],

});