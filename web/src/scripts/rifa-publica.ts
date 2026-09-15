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

  const grilla = raiz.querySelector<HTMLElement>("[data-grilla]")!;
  const botones = new Map<string, HTMLButtonElement>();

  raiz.querySelectorAll<HTMLButtonElement>("[data-numero]").forEach((b) => {
    botones.set(b.dataset.numero!, b);
    b.addEventListener("click", () => {
      const n = b.dataset.numero!;
      if (b.disabled) return;
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
        for (const n of datos.tomados as string[]) marcar(n, "r");
        pintar();
        consultarPronto();
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

  // ---- Grilla en vivo ----
  // Consulta un endpoint liviano con ETag: si nada cambió, el servidor responde
  // 304 sin cuerpo. Cada 5 s tras un cambio, espaciando hasta 20 s si todo sigue
  // igual; se detiene con la pestaña oculta y tras 15 min sin que nadie la toque.
  type Estado = "libre" | "r" | "p";
  const MINIMO = 5_000, MAXIMO = 20_000, INACTIVIDAD = 15 * 60_000;
  const quieto = matchMedia("(prefers-reduced-motion: reduce)");
  const enVivo = raiz.querySelector<HTMLElement>("[data-en-vivo]");
  const total = botones.size;
  let etag = "";
  let espera = MINIMO;
  let temporizador: number | undefined;
  let ultimaActividad = Date.now();

  /** Cambia una casilla de estado. Devuelve true si estaba en la selección de esta persona. */
  function marcar(n: string, estado: Estado): boolean {
    const b = botones.get(n);
    if (!b || b.dataset.estado === estado) return false;
    const perdido = estado !== "libre" && elegidos.delete(n);
    b.dataset.estado = estado;
    b.disabled = estado !== "libre";
    b.setAttribute("aria-pressed", "false");
    b.className = grilla.dataset[estado === "libre" ? "claseLibre" : estado === "r" ? "claseR" : "claseP"]!;
    if (estado === "libre") b.removeAttribute("aria-label");
    else b.setAttribute("aria-label", `${n}, ${estado === "p" ? "vendido" : "reservado"}`);
    if (!quieto.matches) {
      b.animate(
        [{ boxShadow: "0 0 0 3px var(--color-pick)", transform: "scale(1.12)" }, { boxShadow: "0 0 0 0 transparent", transform: "scale(1)" }],
        { duration: 900, easing: "ease-out" },
      );
    }
    return perdido;
  }

  function aplicar(tomados: { n: string; e: "p" | "r" }[]) {
    const nuevos = new Map(tomados.map((t) => [t.n, t.e]));
    const perdidos: string[] = [];
    for (const n of botones.keys()) if (marcar(n, nuevos.get(n) ?? "libre")) perdidos.push(n);
    const pagados = tomados.filter((t) => t.e === "p").length;
    const reservados = tomados.length - pagados;
    raiz.querySelector("[data-reservados]")!.textContent = String(reservados);
    raiz.querySelector("[data-vendidos]")!.textContent = String(pagados);
    raiz.querySelector<HTMLElement>("[data-progreso]")!.style.width = `${(pagados / total) * 100}%`;
    const libres = document.querySelector("[data-libres]");
    if (libres) libres.textContent = String(total - tomados.length);
    if (perdidos.length) {
      aviso.hidden = false;
      aviso.textContent = perdidos.length === 1
        ? `Otra persona acaba de reservar el ${perdidos[0]}. Lo quitamos de tu selección.`
        : `Otra persona acaba de reservar los números ${perdidos.sort().join(", ")}. Los quitamos de tu selección.`;
      pintar();
    }
  }

  async function consultar() {
    temporizador = undefined;
    if (document.hidden || Date.now() - ultimaActividad > INACTIVIDAD) {
      if (enVivo) enVivo.hidden = true;
      return;
    }
    try {
      const res = await fetch(`/api/rifas/publica/${encodeURIComponent(slug)}/estado`, {
        cache: "no-store",
        headers: etag ? { "if-none-match": etag } : {},
      });
      if (res.status === 404) return location.reload();
      if (res.status === 304) {
        espera = Math.min(espera * 1.5, MAXIMO);
      } else if (res.ok) {
        const datos = (await res.json()) as { estado: string; tomados: { n: string; e: "p" | "r" }[] };
        // Cerró: al recargar, la página muestra el cierre y el sorteo.
        if (datos.estado !== "abierta") return location.reload();
        etag = res.headers.get("etag") ?? "";
        aplicar(datos.tomados);
        espera = MINIMO;
      } else throw new Error(String(res.status));
      if (enVivo) enVivo.hidden = false;
    } catch {
      if (enVivo) enVivo.hidden = true;
      espera = Math.min(espera * 2, 60_000);
    }
    programar();
  }

  function programar() {
    clearTimeout(temporizador);
    temporizador = window.setTimeout(consultar, espera);
  }

  function consultarPronto() {
    espera = MINIMO;
    clearTimeout(temporizador);
    temporizador = window.setTimeout(consultar, 0);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(temporizador);
    else { ultimaActividad = Date.now(); consultarPronto(); }
  });
  // Quien vuelve a tocar la página tras un rato quieta la reactiva al tiro.
  for (const evento of ["pointerdown", "keydown", "scroll"] as const) {
    addEventListener(evento, () => {
      const dormida = Date.now() - ultimaActividad > INACTIVIDAD;
      ultimaActividad = Date.now();
      if (dormida) consultarPronto();
    }, { passive: true });
  }
  if (enVivo) enVivo.hidden = false;
  programar();
}
