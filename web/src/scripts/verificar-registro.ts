// Rehace la cadena de hashes del registro en el navegador de quien mira, sin
// preguntarle nada al servidor. Cada anotación guarda el hash de la anterior:
//   hash = sha256("hashAnterior|tipo|datos|creadoEn")
// Si una anotación se editó o se borró, el cálculo deja de calzar desde ahí.
interface Evento { id: number; tipo: string; datos: string | null; hashAnterior: string | null; hash: string; creadoEn: number }

const fuente = document.querySelector<HTMLScriptElement>("[data-eventos]");
const caja = document.querySelector<HTMLElement>("[data-verificacion]");
if (fuente && caja) verificar(JSON.parse(fuente.textContent ?? "[]") as Evento[], caja);

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verificar(eventos: Evento[], caja: HTMLElement) {
  const resultado = caja.querySelector<HTMLElement>("[data-resultado]")!;
  let anterior: string | null = null;
  const fallas: number[] = [];

  for (const e of eventos) {
    const esperado = await sha256(`${anterior ?? ""}|${e.tipo}|${e.datos ?? "null"}|${e.creadoEn}`);
    // Tiene que calzar el hash propio y el enganche con la anotación anterior.
    const ok = esperado === e.hash && (e.hashAnterior ?? null) === anterior;
    if (!ok) fallas.push(e.id);
    anterior = e.hash;
    const marca = document.querySelector<HTMLElement>(`[data-evento="${e.id}"] [data-estado]`);
    if (marca) {
      marca.textContent = ok ? "✓ calza" : "✗ no calza";
      marca.className = `font-mono text-xs ${ok ? "text-ok" : "text-danger"}`;
    }
  }

  if (!eventos.length) {
    resultado.textContent = "Todavía no hay anotaciones que revisar.";
    return;
  }
  if (fallas.length === 0) {
    resultado.className = "text-sm font-semibold text-ok";
    resultado.textContent = `✓ Las ${eventos.length} anotaciones calzan: nadie editó ni borró nada.`;
  } else {
    resultado.className = "text-sm font-semibold text-danger";
    resultado.textContent = `✗ ${fallas.length} de ${eventos.length} anotaciones no calzan. Escríbenos: algo está mal.`;
  }
}
