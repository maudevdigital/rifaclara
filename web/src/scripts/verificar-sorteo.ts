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

      const { ganadores } = await sortear({ azar: r.azar, rifaId: s.id, lista: s.lista, premios: 1 });
      const linea = ganadores[0]!.linea;
      paso(`sha256(azar:${s.id}:huella:0) mod ${s.lista.length} → ${linea}`, true);
      paso(linea === s.ganador?.linea ? "El ganador es correcto" : "El ganador NO coincide", linea === s.ganador?.linea);
    } catch (e) {
      paso(`No se pudo verificar: ${(e as Error).message}`, false);
    } finally {
      boton.disabled = false;
    }
  });
}
