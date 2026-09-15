/** Envía un correo con Resend desde el dominio verificado maudev.cl. */
export async function enviarCorreo(
  env: CloudflareBindings,
  { para, asunto, html, texto }: { para: string; asunto: string; html: string; texto: string },
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Rifa Clara <rifas@maudev.cl>", to: [para], subject: asunto, html, text: texto }),
  });
  if (!res.ok) console.error("Resend respondió", res.status, await res.text());
  return res.ok;
}
