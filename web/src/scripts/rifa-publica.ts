// Grilla interactiva de /r/:slug: elegir números libres, reservar y guardar
// el boleto en este navegador para encontrarlo después.
const raiz = document.querySelector<HTMLElement>("[data-rifa]");
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement) {
  const slug = raiz.dataset.slug!;
  const CLAVE = `rifaclara:boletos:${slug}`;

  // Boletos que esta persona ya reservó en esta rifa, desde este navegador.
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as string[];
    const lista = raiz.querySelector<HTMLElement>("[data-mis-boletos]")!;
    if (guardados.length) {
      lista.hidden = false;
      for (const c of guardados) {
        const a = document.createElement("a");
        a.href = `/boleto/${c}`; a.textContent = c; a.className = "font-mono text-sm text-accent underline underline-offset-2";
        lista.append(a);
      }
    }
  } catch {}

  // Rifa cerrada: no hay grilla para elegir ni formulario.
  if (!raiz.querySelector("[data-reservar]")) return;

  const precio = Number(raiz.dataset.precio);
  const maximo = Number(raiz.dataset.maximo);
  const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
  const elegidos = new Set<string>();
  const barra = raiz.querySelector<HTMLElement>("[data-barra]")!;
  const resumen = raiz.querySelector<HTMLElement>("[data-resumen]")!;
  const form = raiz.querySelector<HTMLFormElement>("[data-reservar]")!;
  const mensaje = raiz.querySelector<HTMLElement>("[data-mensaje]")!;
  const aviso = raiz.querySelector<HTMLElement>("[data-aviso]")!;

  const pintar = () => {
    const n = elegidos.size;
    barra.hidden = n === 0;
    resumen.textContent = `${n} ${n === 1 ? "número" : "números"}: ${[...elegidos].sort().join(", ")} · ${clp.format(n * precio)}`;
  };

  raiz.querySelectorAll<HTMLButtonElement>("[data-numero]").forEach((b) => {
    b.addEventListener("click", () => {
      const n = b.dataset.numero!;
      if (elegidos.has(n)) elegidos.delete(n);
      else if (elegidos.size >= maximo) {
        aviso.hidden = false;
        aviso.textContent = `Puedes elegir hasta ${maximo} números.`;
        return;
      } else elegidos.add(n);
      aviso.hidden = true;
      b.setAttribute("aria-pressed", String(elegidos.has(n)));
      pintar();
    });
  });

  raiz.querySelector("[data-continuar]")!.addEventListener("click", () => {
    form.hidden = false;
    form.querySelector<HTMLInputElement>("input[name=nombre]")!.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    boton.disabled = true;
    mensaje.className = "min-h-5 text-sm text-muted";
    mensaje.textContent = "Reservando…";
    try {
      const res = await fetch(`/api/reservas/rifa/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numeros: [...elegidos], nombre: f.get("nombre"), telefono: f.get("telefono"), sitio: f.get("sitio") }),
      });
      const datos = await res.json().catch(() => ({}));
      if (res.status === 409 && datos.tomados) {
        // Marcar como tomados los que se ganó otra persona y quitarlos de la selección.
        for (const n of datos.tomados as string[]) {
          elegidos.delete(n);
          const b = raiz.querySelector<HTMLButtonElement>(`[data-numero="${n}"]`);
          if (b) { b.disabled = true; b.setAttribute("aria-pressed", "false"); b.className = b.dataset.claseTomado!; }
        }
        pintar();
      }
      if (!res.ok) throw new Error(datos.error ?? "No se pudo reservar");
      try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as string[];
        localStorage.setItem(CLAVE, JSON.stringify([datos.codigo, ...guardados].slice(0, 10)));
      } catch {}
      location.href = `/boleto/${datos.codigo}?nuevo=1`;
    } catch (err) {
      mensaje.className = "min-h-5 text-sm text-danger";
      mensaje.textContent = (err as Error).message;
      boton.disabled = false;
    }
  });

}
