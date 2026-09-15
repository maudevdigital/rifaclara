// Reportar una rifa desde su página pública. No necesita cuenta.
const caja = document.querySelector<HTMLDetailsElement>("[data-denuncia]");
if (caja) {
  const form = caja.querySelector<HTMLFormElement>("[data-form]")!;
  const mensaje = form.querySelector<HTMLElement>("[data-mensaje]")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    const f = new FormData(form);
    boton.disabled = true;
    mensaje.className = "min-h-5 text-sm text-muted";
    mensaje.textContent = "Enviando…";
    try {
      const res = await fetch(`/api/denuncias/rifa/${caja.dataset.slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ motivo: f.get("motivo"), detalle: f.get("detalle"), contacto: f.get("contacto"), sitio: f.get("sitio") }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? "No se pudo enviar el reporte");
      form.innerHTML = "";
      mensaje.className = "text-sm text-ok";
      mensaje.textContent = "Gracias: recibimos tu reporte y lo vamos a revisar.";
      form.append(mensaje);
    } catch (err) {
      mensaje.className = "min-h-5 text-sm text-danger";
      mensaje.textContent = (err as Error).message;
      boton.disabled = false;
    }
  });
}
