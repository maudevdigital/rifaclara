import { Hono } from "hono";
import { rondaDrand } from "@rifaclara/shared";

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

app.notFound((c) => c.json({ error: "No existe esa ruta de la API" }, 404));

export default app;
