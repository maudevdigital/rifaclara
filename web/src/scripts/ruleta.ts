import { formatearNumero, leerRonda, rondaDrand, sha256, sortear } from "@rifaclara/shared";

// Colores de la rueda: fijos en ambos temas (la rueda es un objeto, no fondo).
const COLORES = [
  { fondo: "#1D6359", texto: "#FFFFFF" },
  { fondo: "#E6EEE9", texto: "#13302C" },
  { fondo: "#E9B949", texto: "#2A1F00" },
  { fondo: "#13302C", texto: "#FAF8F3" },
  { fondo: "#94D1BD", texto: "#0F2A26" },
  { fondo: "#FAF8F3", texto: "#13302C" },
];
const MAX_NOMBRES = 500;
const CLAVE = "rifaclara:ruleta";
const VUELTA = Math.PI * 2;

type Modo = "rapido" | "verificable";
interface Prueba { ronda: number; azar: string; huella: string; lista: string[]; linea: string }
interface Giro { nombre: string; prueba: Prueba | null }

const raiz = document.querySelector<HTMLElement>("[data-ruleta]");
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const canvas = $<HTMLCanvasElement>("[data-rueda]");
  const ctx = canvas.getContext("2d")!;
  const textarea = $<HTMLTextAreaElement>("[data-nombres]");
  const cuenta = $("[data-cuenta]");
  const btnGirar = $<HTMLButtonElement>("[data-girar]");
  const estado = $("[data-estado]");
  const dialogo = $("[data-dialogo]");
  const historialEl = $("[data-historial]");
  const historialVacio = $("[data-historial-vacio]");
  const quitar = $<HTMLInputElement>("[data-quitar]");
  const ayudaModo = $("[data-modo-ayuda]");

  let nombres: string[] = [];
  let rotacion = 0;
  let girando = false;
  let modo: Modo = "rapido";
  const historial: Giro[] = [];

  // ---------- estado guardado en este navegador ----------
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (guardado?.texto) textarea.value = guardado.texto;
    if (guardado?.modo === "verificable") modo = "verificable";
    if (guardado?.quitar) quitar.checked = true;
  } catch {}
  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ texto: textarea.value, modo, quitar: quitar.checked })); } catch {}
  };

  // ---------- nombres ----------
  function leerNombres() {
    nombres = textarea.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, MAX_NOMBRES);
    const total = textarea.value.split("\n").filter((l) => l.trim()).length;
    cuenta.textContent = total > MAX_NOMBRES ? `${MAX_NOMBRES} de ${total} (máximo)` : String(nombres.length);
    btnGirar.disabled = girando || nombres.length < 2;
    dibujar();
  }
  const escribirNombres = (lista: string[]) => { textarea.value = lista.join("\n"); leerNombres(); guardar(); };

  // ---------- dibujo ----------
  function colorDe(i: number, n: number) {
    let c = i % COLORES.length;
    // Que el último sector no quede del mismo color que el primero.
    if (n > 1 && i === n - 1 && c === 0) c = 2;
    return COLORES[c]!;
  }

  function recortar(texto: string, ancho: number) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + "…").width > ancho) t = t.slice(0, -1);
    return t + "…";
  }

  function dibujar() {
    const dpr = window.devicePixelRatio || 1;
    const lado = canvas.clientWidth;
    if (!lado) return;
    if (canvas.width !== Math.round(lado * dpr)) { canvas.width = canvas.height = Math.round(lado * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lado, lado);
    const css = getComputedStyle(document.documentElement);
    const tinta = css.getPropertyValue("--ink").trim() || "#13302C";
    const superficie = css.getPropertyValue("--surface").trim() || "#FFFFFF";
    const acento = css.getPropertyValue("--accent").trim() || "#1D6359";
    const c = lado / 2;
    const r = c - 5;
    const n = nombres.length;

    if (n === 0) {
      ctx.beginPath(); ctx.arc(c, c, r, 0, VUELTA); ctx.fillStyle = superficie; ctx.fill();
      ctx.fillStyle = tinta; ctx.font = "500 16px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Escribe al menos dos nombres", c, c);
    } else {
      const seg = VUELTA / n;
      const tamano = Math.max(10, Math.min(22, (r * seg) / 1.9, lado / 22));
      ctx.font = `600 ${tamano}px Inter, sans-serif`;
      for (let i = 0; i < n; i++) {
        const inicio = -Math.PI / 2 + rotacion + i * seg;
        const { fondo, texto } = colorDe(i, n);
        ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, inicio, inicio + seg); ctx.closePath();
        ctx.fillStyle = fondo; ctx.fill();
        if (n <= 150) { ctx.strokeStyle = "rgba(19,48,44,.18)"; ctx.lineWidth = 1; ctx.stroke(); }
        if (n <= 90) {
          ctx.save(); ctx.translate(c, c); ctx.rotate(inicio + seg / 2);
          ctx.fillStyle = texto; ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(recortar(nombres[i]!, r * 0.7), r - 16, 0);
          ctx.restore();
        }
      }
    }
    // Aro, centro y marca.
    ctx.beginPath(); ctx.arc(c, c, r, 0, VUELTA); ctx.lineWidth = 5; ctx.strokeStyle = tinta; ctx.stroke();
    const centro = Math.max(18, r * 0.12);
    ctx.beginPath(); ctx.arc(c, c, centro, 0, VUELTA); ctx.fillStyle = superficie; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = acento; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - centro * 0.38, c + centro * 0.02); ctx.lineTo(c - centro * 0.08, c + centro * 0.32); ctx.lineTo(c + centro * 0.4, c - centro * 0.3);
    ctx.lineWidth = Math.max(3, centro * 0.16); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = acento; ctx.stroke();
  }

  // ---------- animación ----------
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mod = (a: number, m: number) => ((a % m) + m) % m;

  function animarHasta(indice: number) {
    const seg = VUELTA / nombres.length;
    const fraccion = 0.2 + Math.random() * 0.6; // solo visual: dónde cae la aguja dentro del sector
    const objetivo = -(indice + fraccion) * seg;
    const vueltas = reducir ? 0 : 6 + Math.floor(Math.random() * 3);
    const desde = rotacion;
    const hasta = desde + vueltas * VUELTA + mod(objetivo - desde, VUELTA);
    const duracion = reducir ? 350 : 5200;
    const t0 = performance.now();
    return new Promise<void>((listo) => {
      const paso = (t: number) => {
        const p = Math.min(1, (t - t0) / duracion);
        rotacion = desde + (hasta - desde) * (1 - Math.pow(1 - p, 4));
        dibujar();
        if (p < 1) requestAnimationFrame(paso); else listo();
      };
      requestAnimationFrame(paso);
    });
  }

  // Giro lento mientras se espera la ronda de drand.
  function giroDeEspera() {
    let activo = !reducir;
    let previo = performance.now();
    const paso = (t: number) => {
      if (!activo) return;
      rotacion += ((t - previo) / 1000) * 1.6;
      previo = t;
      dibujar();
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return () => { activo = false; };
  }

  function aleatorio(n: number) {
    const tope = Math.floor(2 ** 32 / n) * n;
    const a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0]! >= tope);
    return a[0]! % n;
  }

  // ---------- giro ----------
  async function girar() {
    if (girando || nombres.length < 2) return;
    girando = true;
    btnGirar.disabled = true;
    textarea.readOnly = true;
    dialogo.hidden = true;
    try {
      let indice: number;
      let prueba: Prueba | null = null;
      if (modo === "rapido") {
        estado.textContent = "Girando…";
        indice = aleatorio(nombres.length);
      } else {
        const lista = nombres.map((nombre, i) => `${formatearNumero(i, nombres.length)}:${nombre}`);
        const huella = await sha256(lista.join("\n"));
        // La ronda queda fijada antes de que exista su azar.
        const ronda = rondaDrand(Date.now() / 1000) + 1;
        estado.textContent = `Ronda ${ronda} de drand fijada. Esperando el azar público…`;
        const detener = giroDeEspera();
        try {
          const r = await leerRonda(ronda);
          const { ganadores } = await sortear({ azar: r.azar, rifaId: "ruleta", lista, premios: 1 });
          const linea = ganadores[0]!.linea;
          indice = lista.indexOf(linea);
          prueba = { ronda, azar: r.azar, huella, lista, linea };
        } finally {
          detener();
        }
        estado.textContent = "Azar recibido. Girando…";
      }
      await animarHasta(indice);
      const giro = { nombre: nombres[indice]!, prueba };
      historial.unshift(giro);
      mostrarGanador(giro, indice);
      pintarHistorial();
      estado.textContent = `Ganó ${giro.nombre}.`;
    } catch (e) {
      estado.textContent = `No se pudo completar el giro: ${(e as Error).message}. Revisa tu conexión e inténtalo de nuevo.`;
    } finally {
      girando = false;
      textarea.readOnly = false;
      btnGirar.disabled = nombres.length < 2;
    }
  }

  // ---------- resultado ----------
  function comprobante(p: Prueba) {
    return [
      "Sorteo verificable · Rifa Clara (rifaclara.maudev.cl/ruleta)",
      `Ronda drand quicknet: ${p.ronda}`,
      `Azar: ${p.azar}`,
      `Huella de la lista: ${p.huella}`,
      `Ganador: ${p.linea}`,
      "Cálculo: sha256(azar:ruleta:huella:0) mod cantidad de líneas",
      "",
      "Lista, en orden:",
      ...p.lista,
    ].join("\n");
  }

  function mostrarGanador(giro: Giro, indice: number) {
    $("[data-ganador]").textContent = giro.nombre;
    const pruebaEl = $("[data-prueba]");
    pruebaEl.hidden = !giro.prueba;
    if (giro.prueba) {
      const p = giro.prueba;
      $("[data-prueba-detalle]").textContent =
        `Ronda ${p.ronda} · azar ${p.azar.slice(0, 8)}…${p.azar.slice(-4)} · lista ${p.huella.slice(0, 8)}…`;
    }
    $<HTMLButtonElement>("[data-quitar-ganador]").onclick = () => {
      escribirNombres(nombres.filter((_, i) => i !== indice));
      dialogo.hidden = true;
    };
    $<HTMLButtonElement>("[data-copiar]").onclick = async () => {
      if (!giro.prueba) return;
      try {
        await navigator.clipboard.writeText(comprobante(giro.prueba));
        estado.textContent = "Comprobante copiado.";
      } catch {
        estado.textContent = "Tu navegador no dejó copiar. Selecciona el comprobante a mano.";
      }
    };
    dialogo.hidden = false;
    if (quitar.checked) escribirNombres(nombres.filter((_, i) => i !== indice));
  }

  function pintarHistorial() {
    historialVacio.hidden = historial.length > 0;
    historialEl.innerHTML = "";
    historial.slice(0, 20).forEach((g, i) => {
      const li = document.createElement("li");
      li.className = "flex items-baseline justify-between gap-3";
      const nombre = document.createElement("span");
      nombre.textContent = `${historial.length - i}. ${g.nombre}`;
      const tipo = document.createElement("span");
      tipo.className = g.prueba ? "font-mono text-xs text-ok" : "font-mono text-xs text-muted";
      tipo.textContent = g.prueba ? `✓ ronda ${g.prueba.ronda}` : "rápido";
      li.append(nombre, tipo);
      historialEl.append(li);
    });
  }

  // ---------- controles ----------
  function fijarModo(m: Modo) {
    modo = m;
    raiz.querySelectorAll<HTMLInputElement>("[name=ruleta-modo]").forEach((r) => (r.checked = r.value === m));
    ayudaModo.textContent = m === "rapido"
      ? "Resultado inmediato, con el azar de tu navegador."
      : "El resultado sale de un número aleatorio público de drand, fijado antes de conocerlo. Tarda unos segundos y se puede comprobar.";
    guardar();
  }

  function mezclar(lista: string[]) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) { const j = aleatorio(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  }

  textarea.addEventListener("input", () => { leerNombres(); guardar(); });
  textarea.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); girar(); } });
  btnGirar.addEventListener("click", girar);
  canvas.addEventListener("click", girar);
  quitar.addEventListener("change", guardar);
  raiz.querySelectorAll<HTMLInputElement>("[name=ruleta-modo]").forEach((r) => r.addEventListener("change", () => fijarModo(r.value as Modo)));
  $("[data-mezclar]").addEventListener("click", () => escribirNombres(mezclar(nombres)));
  $("[data-ordenar]").addEventListener("click", () => escribirNombres([...nombres].sort((a, b) => a.localeCompare(b, "es"))));
  $("[data-borrar]").addEventListener("click", () => { if (confirm("¿Borrar todos los nombres?")) escribirNombres([]); });
  $("[data-cerrar]").addEventListener("click", () => { dialogo.hidden = true; });
  $("[data-pantalla]").addEventListener("click", () => {
    const escenario = $("[data-escenario]");
    if (document.fullscreenElement) document.exitFullscreen(); else escenario.requestFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => requestAnimationFrame(dibujar));
  new ResizeObserver(() => dibujar()).observe(canvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", dibujar);

  fijarModo(modo);
  leerNombres();
  document.fonts?.ready.then(dibujar);
}
