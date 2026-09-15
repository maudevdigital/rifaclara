import { leerRonda, sha256, sortear } from "@rifaclara/shared";
import type { SorteoPublico } from "@rifaclara/shared";

// Sorteo pendiente: consultar hasta que se resuelva y recargar.
const pendiente = document.querySelector<HTMLElement>("[data-pendiente]");
if (pendiente?.dataset.id) {
  const id = pendiente.dataset.id;
  const consultar = async () => {
    const res = await fetch(`/api/sorteos/${id}`).catch(() => null);
    const s = res?.ok ? ((await res.json()) as SorteoPublico) : null;
    if (s?.estado === "resuelto") location.reload();
    else setTimeout(consultar, 2000);
  };
  setTimeout(consultar, 1500);
}

// Verificación independiente: el azar se lee desde drand, no desde nuestra API.
const boton = document.querySelector<HTMLButtonElement>("[data-verificar]");
const pasos = document.querySelector<HTMLOListElement>("[data-pasos]");
const datos = document.getElementById("datos-sorteo");

if (boton && pasos && datos) {
  const s = JSON.parse(datos.textContent ?? "{}") as SorteoPublico;
  const paso = (texto: string, ok: boolean) => {
    const li = document.createElement("li");
    li.className = ok ? "text-ok" : "text-danger";
    li.textContent = `${ok ? "✓" : "✗"} ${texto}`;
    pasos.append(li);
    return ok;
  };

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    pasos.innerHTML = "";
    try {
      const huella = await sha256(s.lista.join("\n"));
      if (!paso(`Huella de la lista: ${huella.slice(0, 16)}… coincide con la registrada`, huella === s.huella)) return;

      const r = await leerRonda(s.ronda, { intentos: 1 });
      paso(`Azar de la ronda ${s.ronda} leído desde api.drand.sh y drand.cloudflare.com, y comprobado contra su firma`, true);
      if (!paso("El azar de drand es el mismo que muestra este comprobante", r.azar === s.azar)) return;

      const { ganadores } = await sortear({ azar: r.azar, rifaId: s.id, lista: s.lista, premios: s.premios });
      for (const g of ganadores) paso(`Premio ${g.premio + 1}: sha256(azar:${s.id}:huella:${g.premio}) mod ${s.lista.length - g.premio} → ${g.linea}`, true);
      const ok = ganadores.map((g) => g.linea).join("\n") === s.ganadores.map((g) => g.linea).join("\n");
      paso(ok ? (s.premios > 1 ? "Todos los ganadores son correctos" : "El ganador es correcto") : "Los ganadores NO coinciden", ok);
    } catch (e) {
      paso(`No se pudo verificar: ${(e as Error).message}`, false);
    } finally {
      boton.disabled = false;
    }
  });
}

// Rifas: cada participante comprueba que su boleto estuvo en la lista sellada.
const buscador = document.querySelector<HTMLFormElement>("[data-buscar-boleto]");
if (buscador && datos) {
  const s = JSON.parse(datos.textContent ?? "{}") as SorteoPublico;
  const salida = buscador.querySelector<HTMLElement>("[data-resultado-boleto]")!;
  buscador.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bruto = String(new FormData(buscador).get("codigo") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RC/, "");
    if (bruto.length !== 10) {
      salida.className = "min-h-5 text-sm text-danger";
      salida.textContent = "El código tiene la forma RC-XXXXX-XXXXX.";
      return;
    }
    const codigo = `RC-${bruto.slice(0, 5)}-${bruto.slice(5)}`;
    const huella = await sha256(codigo);
    const mios = s.lista.filter((l) => l.endsWith(`:${huella}`));
    document.querySelectorAll("[data-linea]").forEach((li) => li.classList.toggle("outline-2", mios.includes(li.getAttribute("data-linea")!)));
    const numeros = mios.map((l) => l.slice(0, l.indexOf(":")));
    const ganados = s.ganadores.filter((g) => mios.includes(g.linea));
    salida.className = `min-h-5 text-sm ${mios.length ? "text-ok" : "text-danger"}`;
    salida.textContent = mios.length
      ? `✓ Tu boleto ${codigo} participó con ${numeros.length === 1 ? "el número" : "los números"} ${numeros.join(", ")}.` +
        (ganados.length ? ` ¡Ganaste con el ${ganados.map((g) => g.nombre).join(" y el ")}!` : "")
      : `✗ Ninguna línea corresponde a ${codigo}. Revisa el código; si tu reserva no se pagó antes del cierre, no entró al sorteo.`;
  });
}
