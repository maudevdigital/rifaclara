for (const form of document.querySelectorAll<HTMLFormElement>("[data-lista-espera]")) {
  const mensaje = form.querySelector<HTMLElement>("[data-mensaje]")!;
  const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const falta = !datos.email ? "Escribe tu correo." : !datos.tipo ? "Cuéntanos quién organiza." : !datos.numeros ? "Elige el tamaño de tus rifas." : !datos.pagaria ? "Responde si pagarías." : "";
    if (falta) {
      mensaje.className = "min-h-5 text-sm text-danger";
      mensaje.textContent = falta;
      return;
    }
    boton.disabled = true;
    mensaje.className = "min-h-5 text-sm text-muted";
    mensaje.textContent = "Enviando…";
    try {
      const res = await fetch("/api/lista-espera", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...datos, origen: form.dataset.origen }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo enviar");
      form.reset();
      mensaje.className = "min-h-5 text-sm font-semibold text-ok";
      mensaje.textContent = "¡Listo! Te avisaremos apenas puedas crear tu rifa.";
    } catch (err) {
      mensaje.className = "min-h-5 text-sm text-danger";
      mensaje.textContent = `${(err as Error).message}. Inténtalo de nuevo.`;
    } finally {
      boton.disabled = false;
    }
  });
}
