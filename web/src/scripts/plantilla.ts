import type { DatosPlantilla, Papel } from "../lib/plantilla-pdf";

const MAX_NUMEROS = 1000;
const CLAVE = "rifaclara:plantilla";
const POR_HOJA: Record<Papel, number> = { carta: 8, a4: 8, oficio: 10 };

const raiz = document.querySelector<HTMLElement>("[data-plantilla]");
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement) {
  const campos = [...raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-campo]")];
  const campo = (n: string) => campos.find((c) => c.dataset.campo === n)!;
  const prev = (n: string) => raiz.querySelector<HTMLElement>(`[data-prev="${n}"]`)!;
  const error = raiz.querySelector<HTMLElement>("[data-error]")!;
  const estado = raiz.querySelector<HTMLElement>("[data-estado]")!;
  const boton = raiz.querySelector<HTMLButtonElement>("[data-descargar]")!;

  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (g) for (const c of campos) if (typeof g[c.dataset.campo!] === "string") c.value = g[c.dataset.campo!];
  } catch {}

  function leer(): { datos: DatosPlantilla; problema?: string } {
    const v = (n: string) => campo(n).value.trim();
    const desde = Number(v("desde")), hasta = Number(v("hasta"));
    const qr = v("qr");
    const datos: DatosPlantilla = {
      titulo: v("titulo"), premios: v("premios").split("\n").slice(0, 3).join("\n"), valor: v("valor"),
      fecha: v("fecha"), contacto: v("contacto"), desde, hasta, papel: v("papel") as Papel, qr,
    };
    let problema: string | undefined;
    if (!datos.titulo) problema = "Escribe el nombre de la rifa.";
    else if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 0) problema = "Los números tienen que ser enteros.";
    else if (hasta <= desde) problema = "“Hasta” tiene que ser mayor que “desde”.";
    else if (hasta - desde + 1 > MAX_NUMEROS) problema = `La plantilla admite hasta ${MAX_NUMEROS} números.`;
    else if (qr && !/^https?:\/\/\S+\.\S+/.test(qr)) problema = "El enlace del QR debe empezar con https://";
    return { datos, problema };
  }

  let qrPintado = "";
  async function pintarQr(url: string) {
    const el = prev("qr");
    el.hidden = !url;
    if (!url || url === qrPintado) return;
    qrPintado = url;
    const { renderSVG } = await import("uqr");
    if (qrPintado === url) el.innerHTML = renderSVG(url, { ecc: "M", border: 1, blackColor: "#13302C", whiteColor: "#fff" });
  }

  function actualizar() {
    const { datos, problema } = leer();
    error.hidden = !problema;
    error.textContent = problema ?? "";
    boton.disabled = Boolean(problema);
    const ancho = String(datos.hasta || 0).length;
    const primero = String(datos.desde || 0).padStart(ancho, "0");
    prev("numero").textContent = prev("numero2").textContent = primero;
    prev("titulo").textContent = datos.titulo;
    prev("premios").textContent = datos.premios;
    prev("valor").textContent = datos.valor ? `Valor: ${datos.valor}` : "";
    prev("fecha").textContent = datos.fecha ? `Sorteo: ${datos.fecha}` : "";
    prev("contacto").textContent = datos.contacto;
    if (!problema) {
      const total = datos.hasta - datos.desde + 1;
      const hojas = Math.ceil(total / POR_HOJA[datos.papel]);
      raiz.querySelector("[data-resumen]")!.textContent = `${total.toLocaleString("es-CL")} números · ${hojas} ${hojas === 1 ? "hoja" : "hojas"}`;
    }
    pintarQr(problema ? "" : datos.qr);
    try { localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(campos.map((c) => [c.dataset.campo, c.value])))); } catch {}
  }

  boton.addEventListener("click", async () => {
    const { datos, problema } = leer();
    if (problema) return;
    boton.disabled = true;
    estado.textContent = "Armando el PDF…";
    try {
      // La librería de PDF pesa: se carga solo al descargar.
      const { generarPlantilla } = await import("../lib/plantilla-pdf");
      const { bytes, hojas } = await generarPlantilla(datos);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      const nombre = datos.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      a.href = url;
      a.download = `plantilla-${nombre || "rifa"}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      estado.textContent = `Listo: ${hojas} ${hojas === 1 ? "hoja" : "hojas"} para imprimir.`;
    } catch (e) {
      estado.textContent = `No se pudo generar el PDF: ${(e as Error).message}`;
    } finally {
      boton.disabled = false;
    }
  });

  for (const c of campos) c.addEventListener("input", actualizar);
  actualizar();
}
