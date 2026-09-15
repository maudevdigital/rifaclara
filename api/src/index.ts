import { Hono } from "hono";
import { rondaDrand } from "@rifaclara/shared";
import { borrarAntiguos, sorteos } from "./sorteos";

// Sin ruta pública: todo llega desde rifaclara-web por el service binding API,
// que reenvía rifaclara.maudev.cl/api/* tal cual.
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.get("/salud", (c) =>
  c.json({
    ok: true,
    servicio: "rifaclara-api",
    rondaDrandActual: rondaDrand(Math.floor(Date.now() / 1000)),
  }),
);

app.route("/sorteos", sorteos);

app.notFound((c) => c.json({ error: "No existe esa ruta de la API" }, 404));
app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "Error interno. Intenta de nuevo en unos segundos." }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(borrarAntiguos(env.DB));
  },
} satisfies ExportedHandler<CloudflareBindings>;
