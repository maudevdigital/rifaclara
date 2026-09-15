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
  estado: "pendiente" | "resuelto";
  azar: string | null;
  firma: string | null;
  ganador: { linea: string; indice: number; nombre: string } | null;
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
