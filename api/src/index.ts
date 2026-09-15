import { Hono } from "hono";
import { rondaDrand } from "@rifaclara/shared";
import { auth, conSesion, limpiarAuth, type Entorno } from "./auth";
import { borrarAntiguos, sorteos } from "./sorteos";
import { listaEspera } from "./lista-espera";
import { rifas } from "./rifas";
import { reservas, vencerReservas } from "./reservas";

// Sin ruta pública: todo llega desde rifaclara-web por el service binding API,
// que reenvía rifaclara.maudev.cl/api/* tal cual (cookies incluidas).
const app = new Hono<Entorno>().basePath("/api");

app.use("*", conSesion);

app.get("/salud", (c) =>
  c.json({
    ok: true,
    servicio: "rifaclara-api",
    rondaDrandActual: rondaDrand(Math.floor(Date.now() / 1000)),
  }),
);

app.get("/yo", (c) => {
  const usuario = c.get("usuario");
  return usuario ? c.json({ usuario }) : c.json({ error: "No has ingresado" }, 401);
});

app.route("/auth", auth);
app.route("/rifas", rifas);
app.route("/reservas", reservas);
app.route("/sorteos", sorteos);
app.route("/lista-espera", listaEspera);

app.notFound((c) => c.json({ error: "No existe esa ruta de la API" }, 404));
app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "Error interno. Intenta de nuevo en unos segundos." }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(vencerReservas(env.DB));
    const hora = new Date(evento.scheduledTime);
    if (hora.getUTCHours() === 7 && hora.getUTCMinutes() < 10) {
      ctx.waitUntil(Promise.all([borrarAntiguos(env.DB), limpiarAuth(env.DB)]));
    }
  },
} satisfies ExportedHandler<CloudflareBindings>;
