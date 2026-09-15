export interface GanadorPublico {
  /** 0 = primer premio. */
  premio: number;
  linea: string;
  /** Posición de la línea en la lista original. */
  indice: number;
  nombre: string;
}

/** Contrato de GET /api/sorteos/:id, compartido por la API y la web. */
export interface SorteoPublico {
  id: string;
  tipo: string;
  titulo: string | null;
  /** Líneas "00:Nombre" en el orden sorteado. */
  lista: string[];
  huella: string;
  ronda: number;
  /** Segundos Unix en que drand emite la ronda. */
  momento: number;
  /** Cuántos premios se sortean; los ganadores salen en ese orden. */
  premios: number;
  estado: "pendiente" | "resuelto";
  azar: string | null;
  firma: string | null;
  /** Primer premio. Se mantiene para la ruleta, que sortea uno a la vez. */
  ganador: GanadorPublico | null;
  ganadores: GanadorPublico[];
  creadoEn: number;
  resueltoEn: number | null;
}

/** Respuesta de POST /api/sorteos. */
export interface SorteoCreado {
  id: string;
  huella: string;
  ronda: number;
  momento: number;
}
