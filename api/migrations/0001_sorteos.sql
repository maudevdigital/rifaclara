-- Sorteos verificables compartibles (ruleta y sorteo de nombres).
-- El compromiso (lista, huella y ronda) se guarda antes de que exista el azar;
-- azar, firma y ganador se completan una sola vez, cuando llega la ronda.
CREATE TABLE sorteos (
  id           TEXT PRIMARY KEY,
  tipo         TEXT NOT NULL DEFAULT 'ruleta',
  titulo       TEXT,
  lista        TEXT NOT NULL,             -- JSON: líneas "00:Nombre" en el orden sorteado
  huella       TEXT NOT NULL,             -- sha256 de las líneas unidas por \n
  ronda        INTEGER NOT NULL,          -- ronda de drand quicknet comprometida
  azar         TEXT,
  firma        TEXT,
  ganador      TEXT,                      -- línea ganadora
  creado_en    INTEGER NOT NULL,          -- segundos Unix
  resuelto_en  INTEGER
);

CREATE INDEX sorteos_creado_en ON sorteos (creado_en);
