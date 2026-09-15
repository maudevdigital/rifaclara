/**
 * Cliente mínimo de la API de Flow (flow.cl). Cada llamada lleva el apiKey y
 * la firma `s`: HMAC-SHA256 con la secretKey de los parámetros ordenados por
 * nombre y concatenados como nombre+valor.
 */
const enc = new TextEncoder();

export async function firmarFlow(params: Record<string, string>, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const texto = Object.keys(params).sort().map((k) => k + params[k]).join("");
  const firma = await crypto.subtle.sign("HMAC", clave, enc.encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class ErrorFlow extends Error {}

async function llamar<T>(env: CloudflareBindings, metodo: "GET" | "POST", ruta: string, params: Record<string, string>): Promise<T> {
  const p = { apiKey: env.FLOW_API_KEY, ...params };
  const cuerpo = new URLSearchParams({ ...p, s: await firmarFlow(p, env.FLOW_SECRET_KEY) });
  const res = metodo === "GET"
    ? await fetch(`${env.FLOW_API}${ruta}?${cuerpo}`)
    : await fetch(`${env.FLOW_API}${ruta}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: cuerpo });
  const datos = (await res.json().catch(() => ({}))) as T & { code?: number; message?: string };
  if (!res.ok) throw new ErrorFlow(`Flow respondió ${res.status}: ${datos.message ?? "sin detalle"}`);
  return datos;
}

export function crearPagoFlow(
  env: CloudflareBindings,
  d: { orden: string; asunto: string; monto: number; email: string; urlConfirmacion: string; urlRetorno: string },
) {
  return llamar<{ url: string; token: string; flowOrder: number }>(env, "POST", "/payment/create", {
    commerceOrder: d.orden,
    subject: d.asunto.slice(0, 100),
    currency: "CLP",
    amount: String(d.monto),
    email: d.email,
    urlConfirmation: d.urlConfirmacion,
    urlReturn: d.urlRetorno,
  });
}

/** Estado de un pago según Flow: 1 pendiente, 2 pagado, 3 rechazado, 4 anulado. */
export function estadoPagoFlow(env: CloudflareBindings, token: string) {
  return llamar<{
    flowOrder: number; commerceOrder: string; status: 1 | 2 | 3 | 4; amount: number; currency: string;
    paymentData?: { media?: string | null };
  }>(env, "GET", "/payment/getStatus", { token });
}
