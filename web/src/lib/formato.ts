const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** 2000 → "$2.000" */
export const pesos = (n: number) => clp.format(n);

/** Fecha y hora en Chile: "sábado, 20 de septiembre de 2026, 20:00". */
export function fechaChile(segundos: number, zona = "America/Santiago") {
  return new Intl.DateTimeFormat("es-CL", { timeZone: zona, dateStyle: "full", timeStyle: "short" }).format(segundos * 1000);
}
