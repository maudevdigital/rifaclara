import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { encode } from "uqr";

export type Papel = "carta" | "a4" | "oficio";

export interface DatosPlantilla {
  titulo: string;
  premios: string;
  valor: string;
  fecha: string;
  contacto: string;
  desde: number;
  hasta: number;
  papel: Papel;
  /** Enlace para el QR (WhatsApp, Instagram…). Vacío = sin QR. */
  qr: string;
}

// Tamaños en puntos (1 mm = 2,835 pt). Oficio chileno: 216 × 330 mm.
const PAPELES: Record<Papel, { ancho: number; alto: number; filas: number }> = {
  carta: { ancho: 612, alto: 792, filas: 4 },
  a4: { ancho: 595.28, alto: 841.89, filas: 4 },
  oficio: { ancho: 612.3, alto: 935.4, filas: 5 },
};
const COLUMNAS = 2;
const MARGEN = 28;
const SEPARACION = 12;

const ACENTO = rgb(0.114, 0.388, 0.349); // #1D6359
const TINTA = rgb(0.075, 0.188, 0.173); // #13302C
const SUAVE = rgb(0.341, 0.392, 0.373); // #57645F
const LINEA = rgb(0.76, 0.8, 0.78);

export const boletosPorHoja = (papel: Papel) => PAPELES[papel].filas * COLUMNAS;

/** Números con el mismo ancho: 1..100 → "001".."100"; 0..99 → "00".."99". */
export function numerosDe(desde: number, hasta: number): string[] {
  const ancho = String(hasta).length;
  return Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i).padStart(ancho, "0"));
}

async function qrComoImagen(pdf: PDFDocument, url: string): Promise<PDFImage> {
  const { data, size } = encode(url, { ecc: "M", border: 1 });
  const escala = 8;
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = size * escala;
  const ctx = lienzo.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = "#13302C";
  data.forEach((fila, y) => fila.forEach((negro, x) => negro && ctx.fillRect(x * escala, y * escala, escala, escala)));
  const png = await new Promise<Blob>((ok) => lienzo.toBlob((b) => ok(b!), "image/png"));
  return pdf.embedPng(await png.arrayBuffer());
}

export async function generarPlantilla(d: DatosPlantilla): Promise<{ bytes: Uint8Array; hojas: number }> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.titulo || "Plantilla de rifa");
  pdf.setCreator("Rifa Clara · rifaclara.maudev.cl");
  pdf.setLanguage("es-CL");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qr = d.qr.trim() ? await qrComoImagen(pdf, d.qr.trim()) : null;

  // Las fuentes estándar solo traen caracteres latinos (WinAnsi): emojis y otros
  // símbolos se quitan en vez de imprimirse como "?".
  const admitidos = new Set(normal.getCharacterSet());
  const limpiar = (t: string) =>
    [...t.replace(/\t/g, " ")].filter((c) => c === "\n" || admitidos.has(c.codePointAt(0)!)).join("").replace(/ {2,}/g, " ").trim();

  function envolver(texto: string, fuente: PDFFont, tam: number, ancho: number, maxLineas: number): string[] {
    const lineas: string[] = [];
    for (const parrafo of limpiar(texto).split("\n")) {
      let actual = "";
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
        else { if (actual) lineas.push(actual); actual = palabra; }
      }
      if (actual) lineas.push(actual);
    }
    if (lineas.length > maxLineas) {
      const cortadas = lineas.slice(0, maxLineas);
      let ultima = cortadas[maxLineas - 1]!;
      while (ultima && fuente.widthOfTextAtSize(`${ultima}…`, tam) > ancho) ultima = ultima.slice(0, -1);
      cortadas[maxLineas - 1] = `${ultima}…`;
      return cortadas;
    }
    return lineas;
  }

  const papel = PAPELES[d.papel];
  const w = (papel.ancho - 2 * MARGEN - SEPARACION * (COLUMNAS - 1)) / COLUMNAS;
  const h = (papel.alto - 2 * MARGEN - SEPARACION * (papel.filas - 1)) / papel.filas;
  const colilla = w * 0.3;
  const numeros = numerosDe(d.desde, d.hasta);
  const porHoja = boletosPorHoja(d.papel);
  // Se calculan una vez: todos los boletos comparten los textos.
  const pad = 8;
  const anchoTexto = w - colilla - 2 * pad;
  const titulo = envolver(d.titulo, negrita, 9.5, anchoTexto, 2);
  const premios = envolver(d.premios, normal, 8, anchoTexto, 3);
  const fecha = envolver(d.fecha ? `Sorteo: ${d.fecha}` : "", normal, 7.5, anchoTexto, 2);
  const contacto = envolver(d.contacto, normal, 7, anchoTexto, 2);
  const valor = limpiar(d.valor ? `Valor: ${d.valor}` : "");

  function boleto(pagina: PDFPage, x: number, yArriba: number, numero: string) {
    const y = yArriba - h;
    pagina.drawRectangle({ x, y, width: w, height: h, borderColor: LINEA, borderWidth: 0.8, borderDashArray: [3, 2] });
    pagina.drawLine({ start: { x: x + colilla, y: y + 4 }, end: { x: x + colilla, y: yArriba - 4 }, color: LINEA, thickness: 0.8, dashArray: [3, 2] });

    // Colilla: queda en el talonario con los datos de quien compra.
    const cx = x + 7;
    pagina.drawText("N°", { x: cx, y: yArriba - 16, size: 7, font: normal, color: SUAVE });
    pagina.drawText(numero, { x: cx, y: yArriba - 36, size: 18, font: negrita, color: ACENTO });
    const lineaColilla = (texto: string, yy: number) => {
      pagina.drawText(texto, { x: cx, y: yy + 3, size: 6.5, font: normal, color: SUAVE });
      pagina.drawLine({ start: { x: cx, y: yy - 9 }, end: { x: x + colilla - 7, y: yy - 9 }, color: LINEA, thickness: 0.6 });
    };
    lineaColilla("Nombre", yArriba - 58);
    lineaColilla("Teléfono", yArriba - 82);
    lineaColilla("Vendió", yArriba - 106);
    pagina.drawRectangle({ x: cx, y: y + 9, width: 7, height: 7, borderColor: SUAVE, borderWidth: 0.7 });
    pagina.drawText("Pagado", { x: cx + 11, y: y + 10, size: 7, font: normal, color: SUAVE });

    // Boleto: se entrega a quien compra.
    const bx = x + colilla + pad;
    let cursor = yArriba - pad - 9;
    for (const l of titulo) { pagina.drawText(l, { x: bx, y: cursor, size: 9.5, font: negrita, color: TINTA }); cursor -= 11.5; }
    cursor -= 2;
    for (const l of premios) { pagina.drawText(l, { x: bx, y: cursor, size: 8, font: normal, color: TINTA }); cursor -= 10; }
    if (valor) { cursor -= 2; pagina.drawText(valor, { x: bx, y: cursor, size: 9, font: negrita, color: ACENTO }); cursor -= 11; }
    for (const l of fecha) { pagina.drawText(l, { x: bx, y: cursor, size: 7.5, font: normal, color: TINTA }); cursor -= 9; }
    for (const l of contacto) { pagina.drawText(l, { x: bx, y: cursor, size: 7, font: normal, color: SUAVE }); cursor -= 8.5; }

    const lado = 40;
    if (qr) pagina.drawImage(qr, { x: bx, y: y + 14, width: lado, height: lado });
    pagina.drawText("Sorteo verificable en rifaclara.maudev.cl", { x: bx, y: y + 5, size: 5.5, font: normal, color: SUAVE });
    const ancho = negrita.widthOfTextAtSize(numero, 22);
    pagina.drawText(numero, { x: x + w - pad - ancho, y: y + 12, size: 22, font: negrita, color: ACENTO });
    pagina.drawText("N°", { x: x + w - pad - ancho - 13, y: y + 13, size: 8, font: normal, color: SUAVE });
  }

  for (let i = 0; i < numeros.length; i += porHoja) {
    const pagina = pdf.addPage([papel.ancho, papel.alto]);
    numeros.slice(i, i + porHoja).forEach((numero, j) => {
      const col = j % COLUMNAS;
      const fila = Math.floor(j / COLUMNAS);
      boleto(pagina, MARGEN + col * (w + SEPARACION), papel.alto - MARGEN - fila * (h + SEPARACION), numero);
    });
  }
  return { bytes: await pdf.save(), hojas: pdf.getPageCount() };
}
