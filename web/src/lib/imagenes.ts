// Imágenes de las rifas, preparadas en el navegador del organizador: la foto se
// achica antes de subirla y la tarjeta para compartir (og:image) se dibuja en un
// canvas. Así el servidor no gasta CPU (el plan gratuito da 10 ms por petición).

const LADO_MAXIMO = 1200;

function lienzo(ancho: number, alto: number) {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  return [c, c.getContext("2d")!] as const;
}

function aBlob(c: HTMLCanvasElement, tipo: string, calidad: number) {
  return new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la imagen"))), tipo, calidad));
}

/** Achica la foto a 1200 px por lado como máximo y la comprime (WebP, o JPEG si el navegador no sabe). */
export async function achicarFoto(archivo: File): Promise<{ blob: Blob; imagen: ImageBitmap }> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige una imagen (JPG, PNG o WebP)");
  const original = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(original.width, original.height));
  const [c, ctx] = lienzo(Math.round(original.width * escala), Math.round(original.height * escala));
  ctx.drawImage(original, 0, 0, c.width, c.height);
  let blob = await aBlob(c, "image/webp", 0.82);
  if (blob.type !== "image/webp") blob = await aBlob(c, "image/jpeg", 0.85);
  return { blob, imagen: await createImageBitmap(c) };
}

/** Carga una imagen del mismo sitio (por ejemplo /fotos/...) para dibujarla en un canvas. */
export async function cargarImagen(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar la foto");
  return createImageBitmap(await res.blob());
}

function envolver(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho) actual = prueba;
    else { if (actual) lineas.push(actual); actual = palabra; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    let ultima = lineas[maxLineas - 1]!;
    while (ultima && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);
    return [...lineas.slice(0, maxLineas - 1), `${ultima}…`];
  }
  return lineas;
}

function marca(ctx: CanvasRenderingContext2D, x: number, y: number, lado: number, fondo: string, trazo: string) {
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.roundRect(x, y, lado, lado, lado * 0.24);
  ctx.fill();
  ctx.strokeStyle = trazo;
  ctx.lineWidth = lado * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + lado * 0.28, y + lado * 0.53);
  ctx.lineTo(x + lado * 0.44, y + lado * 0.69);
  ctx.lineTo(x + lado * 0.74, y + lado * 0.33);
  ctx.stroke();
}

export interface DatosTarjeta {
  titulo: string;
  premio: string;
  precio: string;
  sorteo: string;
  foto?: ImageBitmap | null;
}

/** Tarjeta de 1200×630 que se ve al compartir la rifa por WhatsApp o redes. */
export async function dibujarTarjeta(d: DatosTarjeta): Promise<Blob> {
  await Promise.all([
    document.fonts.load("700 54px Sora"),
    document.fonts.load("500 28px Inter"),
    document.fonts.load("600 34px 'JetBrains Mono'"),
  ]).catch(() => {});
  const [c, ctx] = lienzo(1200, 630);
  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, 1200, 630);

  // Izquierda: la foto recortada para llenar, o un bloque de color con la marca.
  const anchoFoto = 540;
  if (d.foto) {
    const escala = Math.max(anchoFoto / d.foto.width, 630 / d.foto.height);
    const w = d.foto.width * escala, h = d.foto.height * escala;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, anchoFoto, 630);
    ctx.clip();
    ctx.drawImage(d.foto, (anchoFoto - w) / 2, (630 - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#1d6359";
    ctx.fillRect(0, 0, anchoFoto, 630);
    marca(ctx, anchoFoto / 2 - 90, 225, 180, "#faf8f3", "#1d6359");
  }

  // Derecha: título, premio, precio y fecha.
  const x = anchoFoto + 60, ancho = 1200 - x - 56;
  let y = 92;
  ctx.fillStyle = "#57645f";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.fillText("RIFA · SORTEO VERIFICABLE", x, y);
  y += 30;
  ctx.fillStyle = "#13302c";
  ctx.font = "700 52px Sora, sans-serif";
  for (const l of envolver(ctx, d.titulo, ancho, 3)) { y += 60; ctx.fillText(l, x, y); }
  y += 50;
  ctx.fillStyle = "#13302c";
  ctx.font = "500 28px Inter, sans-serif";
  for (const l of envolver(ctx, d.premio, ancho, 2)) { ctx.fillText(l, x, y); y += 38; }
  y += 18;
  ctx.font = "600 34px 'JetBrains Mono', monospace";
  const precio = `${d.precio} por número`;
  const anchoPrecio = ctx.measureText(precio).width + 36;
  ctx.fillStyle = "#e9b949";
  ctx.beginPath();
  ctx.roundRect(x, y - 38, anchoPrecio, 56, 12);
  ctx.fill();
  ctx.fillStyle = "#2a1f00";
  ctx.fillText(precio, x + 18, y + 2);
  ctx.fillStyle = "#57645f";
  ctx.font = "500 24px Inter, sans-serif";
  ctx.fillText(`Sorteo: ${d.sorteo}`, x, y + 60);

  // Pie: marca y dominio.
  marca(ctx, x, 540, 44, "#1d6359", "#ffffff");
  ctx.fillStyle = "#13302c";
  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillText("rifaclara.maudev.cl", x + 60, 570);

  return aBlob(c, "image/jpeg", 0.86);
}

/** Sube la foto (tipo "foto") o la tarjeta (tipo "og") de una rifa del organizador. */
export async function subirImagen(rifaId: string, tipo: "foto" | "og", blob: Blob): Promise<string> {
  const res = await fetch(`/api/imagenes/${rifaId}?tipo=${tipo}`, { method: "POST", headers: { "content-type": blob.type }, body: blob });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? "No se pudo subir la imagen");
  return datos.url as string;
}

/** Fecha del sorteo en corto para la tarjeta: "sáb 20 sep, 20:00". */
export function fechaCorta(segundos: number, zona = "America/Santiago") {
  return new Intl.DateTimeFormat("es-CL", { timeZone: zona, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(segundos * 1000).replace(/\./g, "");
}
