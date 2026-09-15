-- Organizadores que quieren crear su rifa cuando exista la fase 2.
-- Sirve para validar demanda y disposición a pagar antes de construir pagos.
CREATE TABLE lista_espera (
  email      TEXT PRIMARY KEY,
  tipo       TEXT NOT NULL,     -- bomberos, colegio, club, fundacion, junta, persona, otro
  numeros    TEXT NOT NULL,     -- tamaño habitual de sus rifas
  pagaria    TEXT NOT NULL,     -- si, tal-vez, no (a $4.990 por rifa de hasta 500 números)
  origen     TEXT,              -- página donde se inscribió
  creado_en  INTEGER NOT NULL,
  actualizado_en INTEGER NOT NULL
);
