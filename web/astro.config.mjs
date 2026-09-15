// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://rifaclara.maudev.cl",
  adapter: cloudflare(),
  vite: { plugins: [tailwindcss()] },
});
