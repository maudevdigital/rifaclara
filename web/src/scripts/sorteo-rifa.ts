import type { SorteoPublico } from "@rifaclara/shared";
import { comprobarLocal, crearSorteo, enlaceSorteo, esperarResultado, nombrePremio } from "../lib/sorteo-remoto";

const MAX_NUMEROS = 10000;
const CLAVE = "rifaclara:sorteo-rifa";

const raiz = document.querySelector<HTMLElement>("[data-sorteo-rifa]");
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const pantalla = $("[data-pantalla-numero]");
  const etiqueta = $("[data-etiqueta]");
  const subtitulo = $("[data-subtitulo]");
  const resultados = $<HTMLOListElement>("[data-resultados]");
  const estado = $("[data-estado]");
  const btn = $<HTMLButtonElement>("[data-sortear]");
  const cuenta = $("[data-cuenta]");
  const errorNumeros = $("[data-error-numeros]");
  const titulo = $<HTMLInputElement>("[data-titulo]");
  const desde = $<HTMLInputElement>("[data-desde]");
  const hasta = $<HTMLInputElement>("[data-hasta]");
  const vendidos = $<HTMLTextAreaElement>("[data-vendidos]");
  const premios = $<HTMLInputElement>("[data-premios]");
  const compartir = $("[data-compartir]");
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let modo: "rango" | "vendidos" = "rango";
  let sorteando = false;

  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (g) {
      titulo.value = g.titulo ?? ""; desde.value = g.desde ?? "1"; hasta.value = g.hasta ?? "100";
      vendidos.value = g.vendidos ?? ""; premios.value = g.premios ?? "3";
      if (g.modo === "vendidos") modo = "vendidos";
    }
  } catch {}
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ titulo: titulo.value, desde: desde.value, hasta: hasta.value, vendidos: vendidos.value, premios: premios.value, modo }));
    } catch {}
  };

  /** Números como texto con el mismo ancho: 1..100 → "001".."100"; 0..99 → "00".."99". */
  function leerNumeros(): { numeros: string[]; error?: string } {
    if (modo === "rango") {
      const a = Number(desde.value), b = Number(hasta.value);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0) return { numeros: [], error: "Escribe números enteros." };
      if (b <= a) return { numeros: [], error: "“Hasta” tiene que ser mayor que “desde”." };
      if (b - a + 1 > MAX_NUMEROS) return { numeros: [], error: `Se sortean hasta ${MAX_NUMEROS.toLocaleString("es-CL")} números.` };
      const ancho = String(b).length;
      return { numeros: Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(ancho, "0")) };
    }
    const partes = vendidos.value.split(/[\s,;]+/).filter(Boolean);
    const malo = partes.find((p) => !/^\d{1,5}$/.test(p));
    if (malo) return { numeros: [], error: `“${malo}” no es un número.` };
    const ancho = Math.max(0, ...partes.map((p) => String(Number(p)).length), ...partes.map((p) => p.length));
    const numeros = partes.map((p) => String(Number(p)).padStart(ancho, "0"));
    const repetido = numeros.find((n, i) => numeros.indexOf(n) !== i);
    if (repetido) return { numeros: [], error: `El ${repetido} está repetido.` };
    if (numeros.length > MAX_NUMEROS) return { numeros: [], error: `Se sortean hasta ${MAX_NUMEROS.toLocaleString("es-CL")} números.` };
    return { numeros: [...numeros].sort((x, y) => Number(x) - Number(y)) };
  }

  function actualizar() {
    const { numeros, error } = leerNumeros();
    const p = Number(premios.value);
    const errorPremios = !Number.isInteger(p) || p < 1 || p > 20
      ? "Elige entre 1 y 20 premios."
      : numeros.length && p >= numeros.length ? "Tiene que haber más números que premios." : "";
    const mensaje = error ?? (numeros.length < 2 && modo === "vendidos" ? "Pega al menos dos números." : errorPremios);
    errorNumeros.hidden = !mensaje;
    errorNumeros.textContent = mensaje;
    cuenta.textContent = numeros.length.toLocaleString("es-CL");
    btn.disabled = sorteando || Boolean(mensaje);
    $("[data-panel-rango]").hidden = modo !== "rango";
    $("[data-panel-vendidos]").hidden = modo !== "vendidos";
    raiz.querySelectorAll<HTMLInputElement>("[name=rifa-modo]").forEach((r) => (r.checked = r.value === modo));
    return { numeros, premios: p };
  }

  // ---------- animación tipo tómbola ----------
  function barajar(numeros: string[]) {
    let activo = true;
    const paso = () => {
      if (!activo) return;
      pantalla.textContent = numeros[Math.floor(Math.random() * numeros.length)]!;
      setTimeout(paso, 70);
    };
    if (!reducir) paso();
    return () => { activo = false; };
  }
  const pausa = (ms: number) => new Promise((r) => setTimeout(r, reducir ? 0 : ms));

  async function revelar(s: SorteoPublico, numeros: string[]) {
    for (const g of s.ganadores) {
      etiqueta.textContent = nombrePremio(g.premio);
      subtitulo.textContent = "";
      const detener = barajar(numeros);
      await pausa(2200);
      detener();
      pantalla.textContent = g.nombre;
      subtitulo.textContent = `Gana el ${nombrePremio(g.premio)}`;
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3";
      const nombre = document.createElement("span");
      nombre.className = "text-sm text-muted";
      nombre.textContent = nombrePremio(g.premio);
      const num = document.createElement("span");
      num.className = "rounded-md bg-pick px-2.5 py-1 font-mono text-lg font-semibold text-pick-ink";
      num.textContent = g.nombre;
      li.append(nombre, num);
      resultados.append(li);
      await pausa(900);
    }
  }

  async function sortear() {
    const { numeros, premios: p } = actualizar();
    if (sorteando || btn.disabled) return;
    sorteando = true;
    btn.disabled = true;
    compartir.hidden = true;
    resultados.innerHTML = "";
    etiqueta.textContent = "Sorteando";
    let detener = () => {};
    try {
      estado.textContent = "Registrando la rifa…";
      const creado = await crearSorteo({ tipo: "rifa", nombres: numeros, premios: p, titulo: titulo.value.trim() || undefined });
      estado.textContent = `Ronda ${creado.ronda} de drand fijada y registrada. Esperando el azar público…`;
      subtitulo.textContent = "Esperando el azar público";
      detener = barajar(numeros);
      const s = await esperarResultado(creado);
      await comprobarLocal(s, numeros);
      detener();
      estado.textContent = "Azar recibido y comprobado.";
      await revelar(s, numeros);
      etiqueta.textContent = s.premios === 1 ? "Número ganador" : "Sorteo terminado";
      if (s.premios > 1) { pantalla.textContent = "✓"; subtitulo.textContent = `${s.premios} números ganadores`; }
      const enlace = enlaceSorteo(s.id);
      $<HTMLAnchorElement>("[data-enlace]").href = enlace;
      $("[data-compartir-detalle]").textContent = `Ronda ${s.ronda} · lista ${s.huella.slice(0, 12)}… · ${enlace}`;
      $<HTMLButtonElement>("[data-copiar]").onclick = async () => {
        try { await navigator.clipboard.writeText(enlace); estado.textContent = "Enlace copiado."; }
        catch { estado.textContent = `Tu navegador no dejó copiar. El enlace es ${enlace}`; }
      };
      compartir.hidden = false;
      estado.textContent = "Listo. Comparte el enlace para que cualquiera compruebe el resultado.";
    } catch (e) {
      detener();
      pantalla.textContent = "···";
      etiqueta.textContent = "No se pudo sortear";
      subtitulo.textContent = "";
      estado.textContent = `${(e as Error).message}. Revisa tu conexión e inténtalo de nuevo.`;
    } finally {
      sorteando = false;
      actualizar();
    }
  }

  for (const el of [titulo, desde, hasta, vendidos, premios]) el.addEventListener("input", () => { actualizar(); guardar(); });
  raiz.querySelectorAll<HTMLInputElement>("[name=rifa-modo]").forEach((r) =>
    r.addEventListener("change", () => { modo = r.value as typeof modo; actualizar(); guardar(); }),
  );
  btn.addEventListener("click", sortear);
  $("[data-pantalla]").addEventListener("click", () => {
    const escenario = $("[data-escenario]");
    if (document.fullscreenElement) document.exitFullscreen(); else escenario.requestFullscreen?.();
  });
  actualizar();
}
