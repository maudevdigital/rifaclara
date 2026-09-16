// OpenTimestamps: sella una huella en la cadena de Bitcoin, gratis.
//
// Solo se implementa la parte de crear el sello, que es la que necesita el
// servidor. El archivo .ots que queda es el estándar: cualquiera lo verifica
// con la herramienta oficial (`ots upgrade` y `ots verify`), sin pasar por
// Rifa Clara. Formato de un archivo "detached" (python-opentimestamps,
// DetachedTimestampFile.serialize):
//
//   cabecera mágica (31 bytes) · versión (1) · operación del hash (0x08 = sha256)
//   · huella (32 bytes) · lo que respondió el calendario
//
// Un calendario responde con las operaciones que llevan de la huella a su
// propio árbol, terminando en un "sello pendiente": la anotación en Bitcoin
// llega sola unas horas después y la recoge quien verifica.

const MAGICA = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00,
  0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);
const VERSION = 0x01;
const OP_SHA256 = 0x08;
// Marca que separa dos ramas cuando hay más de un calendario.
const BIFURCACION = 0xff;

/** Calendarios públicos del proyecto OpenTimestamps. */
export const CALENDARIOS = ["https://a.pool.opentimestamps.org", "https://b.pool.opentimestamps.org"];

/** Envía la huella a un calendario y devuelve su parte del comprobante. */
export async function pedirSello(digest: Uint8Array, calendario: string, ms = 8000): Promise<Uint8Array> {
  const res = await fetch(`${calendario}/digest`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", accept: "application/vnd.opentimestamps.v1" },
    body: digest,
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`El calendario ${calendario} respondió ${res.status}`);
  const cuerpo = new Uint8Array(await res.arrayBuffer());
  if (cuerpo.length === 0) throw new Error(`El calendario ${calendario} respondió vacío`);
  return cuerpo;
}

/** Arma el archivo .ots con la huella y lo que respondieron los calendarios. */
export function archivoOts(digest: Uint8Array, respuestas: Uint8Array[]): Uint8Array {
  if (digest.length !== 32) throw new Error("La huella debe ser un sha256 de 32 bytes");
  if (respuestas.length === 0) throw new Error("No hay ningún sello que guardar");
  // Con varias ramas, todas menos la última van precedidas por la marca.
  const ramas = respuestas.flatMap((r, i) => (i < respuestas.length - 1 ? [new Uint8Array([BIFURCACION]), r] : [r]));
  const partes = [MAGICA, new Uint8Array([VERSION, OP_SHA256]), digest, ...ramas];
  const total = partes.reduce((n, p) => n + p.length, 0);
  const archivo = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { archivo.set(p, i); i += p.length; }
  return archivo;
}

/**
 * Sella una huella en todos los calendarios que respondan. Si ninguno
 * contesta, avisa: quien llama lo vuelve a intentar en la próxima pasada.
 */
export async function sellar(digest: Uint8Array): Promise<{ archivo: Uint8Array; calendarios: string[] }> {
  const intentos = await Promise.allSettled(CALENDARIOS.map((c) => pedirSello(digest, c)));
  const respuestas: Uint8Array[] = [];
  const calendarios: string[] = [];
  intentos.forEach((r, i) => {
    if (r.status === "fulfilled") { respuestas.push(r.value); calendarios.push(CALENDARIOS[i]!); }
    else console.error("Calendario sin respuesta:", CALENDARIOS[i], r.reason);
  });
  if (!respuestas.length) throw new Error("Ningún calendario respondió");
  return { archivo: archivoOts(digest, respuestas), calendarios };
}

/** sha256 en bytes (el de shared devuelve texto). */
export async function digestDe(datos: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export const aHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
