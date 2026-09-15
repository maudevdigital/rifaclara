import { Hono } from "hono";
import { tramoPara } from "@rifaclara/shared";
import type { Entorno } from "./auth";
import { requiereUsuario } from "./auth";
import { eventoRifa } from "./eventos";
import { crearPagoFlow, ErrorFlow, estadoPagoFlow } from "./flow";
import { generarId } from "./lista";

const ahora = () => Math.floor(Date.now() / 1000);
const ESTADOS = { 1: "pendiente", 2: "pagado", 3: "rechazado", 4: "anulado" } as const;

/**
 * Consulta a Flow el estado real del pago (nunca se confía en lo que llega en
 * la petición) y, si está pagado, publica la rifa. Idempotente.
 */
async function procesarPago(db: D1Database, env: CloudflareBindings, token: string) {
  const f = await estadoPagoFlow(env, token);
  const pago = await db.prepare("SELECT id, rifa_id, monto, tramo, estado FROM pagos WHERE id = ?")
    .bind(f.commerceOrder).first<{ id: string; rifa_id: string; monto: number; tramo: string; estado: string }>();
  if (!pago) throw new Error(`Flow informó un pago desconocido: ${f.commerceOrder}`);
  if (f.currency !== "CLP" || Number(f.amount) !== pago.monto) throw new Error(`Monto distinto en el pago ${pago.id}`);
  const estado = ESTADOS[f.status];

  if (estado === "pagado" && pago.estado !== "pagado") {
    await db.batch([
      db.prepare("UPDATE pagos SET estado = 'pagado', pagado_en = ?, medio = ?, flow_order = ? WHERE id = ? AND estado != 'pagado'")
        .bind(ahora(), f.paymentData?.media ?? null, f.flowOrder, pago.id),
      db.prepare("UPDATE rifas SET estado = 'abierta', plan = ?, actualizado_en = ? WHERE id = ? AND estado = 'pago_pendiente'")
        .bind(pago.tramo, ahora(), pago.rifa_id),
      await eventoRifa(db, pago.rifa_id, "plan_pagado", { pago: pago.id, monto: pago.monto, tramo: pago.tramo, flowOrder: f.flowOrder }),
    ]);
  } else if ((estado === "rechazado" || estado === "anulado") && pago.estado === "pendiente") {
    await db.prepare("UPDATE pagos SET estado = ? WHERE id = ?").bind(estado, pago.id).run();
  }
  return { rifaId: pago.rifa_id, estado };
}

export const pagos = new Hono<Entorno>();

/** El organizador inicia el pago de su rifa: devuelve la página de pago de Flow. */
pagos.post("/rifa/:id", requiereUsuario, async (c) => {
  const usuario = c.get("usuario")!;
  const r = await c.env.DB.prepare("SELECT id, titulo, desde, hasta, estado, cierre_en FROM rifas WHERE id = ? AND usuario_id = ?")
    .bind(c.req.param("id"), usuario.id).first<{ id: string; titulo: string; desde: number; hasta: number; estado: string; cierre_en: number }>();
  if (!r) return c.json({ error: "No existe esa rifa en tu cuenta." }, 404);
  if (r.estado !== "pago_pendiente") return c.json({ error: "Esta rifa ya está pagada." }, 409);
  if (r.cierre_en < ahora() + 3600) return c.json({ error: "La fecha de cierre ya está muy cerca. Crea la rifa de nuevo con otra fecha." }, 409);
  const cantidad = r.hasta - r.desde + 1;
  const tramo = tramoPara(cantidad);
  if (!tramo || tramo.precio === 0) return c.json({ error: "Esta rifa no necesita pago." }, 409);

  const orden = `rc-${generarId(12)}`;
  let flow: Awaited<ReturnType<typeof crearPagoFlow>>;
  try {
    flow = await crearPagoFlow(c.env, {
      orden,
      asunto: `Rifa Clara · rifa de ${cantidad} números · ${r.titulo}`,
      monto: tramo.precio,
      email: usuario.email,
      urlConfirmacion: `${c.env.SITIO}/api/pagos/flow/confirmacion`,
      urlRetorno: `${c.env.SITIO}/api/pagos/flow/retorno`,
    });
  } catch (e) {
    if (!(e instanceof ErrorFlow)) throw e;
    console.error(e);
    // Flow rechaza, por ejemplo, correos con dominios que no existen.
    return c.json({ error: "Flow no pudo iniciar el pago. Revisa que el correo de tu cuenta sea válido o intenta en unos minutos." }, 502);
  }
  await c.env.DB.prepare(
    "INSERT INTO pagos (id, rifa_id, usuario_id, tramo, monto, flow_token, flow_order, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(orden, r.id, usuario.id, tramo.id, tramo.precio, flow.token, flow.flowOrder, ahora()).run();
  return c.json({ url: `${flow.url}?token=${flow.token}` });
});

/** Aviso de Flow (servidor a servidor) cuando cambia el estado de un pago. */
pagos.post("/flow/confirmacion", async (c) => {
  const token = String((await c.req.parseBody()).token ?? "");
  if (!token) return c.text("falta token", 400);
  try {
    await procesarPago(c.env.DB, c.env, token);
  } catch (e) {
    console.error(e);
    // 5xx si Flow no respondió (puede reintentar); 400 si el pago no es nuestro o no calza.
    return c.text("no procesado", e instanceof ErrorFlow ? 502 : 400);
  }
  return c.text("ok");
});

/** Flow devuelve al organizador aquí (por POST) al terminar de pagar. */
pagos.on(["GET", "POST"], "/flow/retorno", async (c) => {
  const token = c.req.method === "POST" ? String((await c.req.parseBody()).token ?? "") : (c.req.query("token") ?? "");
  if (!token) return c.redirect("/panel", 303);
  try {
    const { rifaId, estado } = await procesarPago(c.env.DB, c.env, token);
    return c.redirect(`/panel/rifas/${rifaId}?pago=${estado}`, 303);
  } catch (e) {
    console.error(e);
    return c.redirect("/panel?pago=error", 303);
  }
});
