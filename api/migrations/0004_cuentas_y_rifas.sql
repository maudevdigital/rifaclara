-- Fase 2: cuentas de organizadores y rifas completas.

CREATE TABLE usuarios (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  nombre         TEXT,
  creado_en      INTEGER NOT NULL,
  ultimo_ingreso INTEGER
);

-- Solo se guarda el SHA-256 del token que va en el correo.
CREATE TABLE enlaces_ingreso (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  vence_en   INTEGER NOT NULL,
  usado_en   INTEGER,
  creado_en  INTEGER NOT NULL
);

-- Solo se guarda el SHA-256 del id que va en la cookie.
CREATE TABLE sesiones (
  id_hash    TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id),
  vence_en   INTEGER NOT NULL,
  creado_en  INTEGER NOT NULL
);
CREATE INDEX sesiones_usuario ON sesiones (usuario_id);

CREATE TABLE rifas (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  usuario_id      TEXT NOT NULL REFERENCES usuarios (id),
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  premios         TEXT NOT NULL,              -- JSON: ["TV 55\"", "Canasta"]
  precio          INTEGER NOT NULL,           -- en la unidad de la moneda (CLP)
  desde           INTEGER NOT NULL,
  hasta           INTEGER NOT NULL,
  medios_pago     TEXT NOT NULL,              -- instrucciones de pago, texto libre
  whatsapp        TEXT,
  cierre_en       INTEGER NOT NULL,
  horas_reserva   INTEGER NOT NULL DEFAULT 24,
  max_por_persona INTEGER NOT NULL DEFAULT 10,
  estado          TEXT NOT NULL DEFAULT 'abierta', -- abierta, cerrada, sorteada, cancelada
  visibilidad     TEXT NOT NULL DEFAULT 'publica', -- publica, oculta
  pais            TEXT NOT NULL DEFAULT 'CL',
  moneda          TEXT NOT NULL DEFAULT 'CLP',
  zona_horaria    TEXT NOT NULL DEFAULT 'America/Santiago',
  plan            TEXT NOT NULL DEFAULT 'gratis',
  sorteo_id       TEXT REFERENCES sorteos (id),
  creado_en       INTEGER NOT NULL,
  actualizado_en  INTEGER NOT NULL
);
CREATE INDEX rifas_usuario ON rifas (usuario_id);
CREATE INDEX rifas_estado_cierre ON rifas (estado, cierre_en);

CREATE TABLE reservas (
  codigo    TEXT PRIMARY KEY,                 -- se muestra como RC-XXXX-XXXX
  rifa_id   TEXT NOT NULL REFERENCES rifas (id),
  nombre    TEXT NOT NULL,
  telefono  TEXT NOT NULL,
  estado    TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, pagada, vencida, liberada
  vence_en  INTEGER NOT NULL,
  creado_en INTEGER NOT NULL,
  pagada_en INTEGER
);
CREATE INDEX reservas_rifa ON reservas (rifa_id, estado);
CREATE INDEX reservas_vencimiento ON reservas (estado, vence_en);

-- Una fila por número tomado. La PK impide vender dos veces el mismo número.
CREATE TABLE numeros (
  rifa_id        TEXT NOT NULL REFERENCES rifas (id),
  numero         TEXT NOT NULL,
  reserva_codigo TEXT NOT NULL REFERENCES reservas (codigo),
  PRIMARY KEY (rifa_id, numero)
);
CREATE INDEX numeros_reserva ON numeros (reserva_codigo);

CREATE TABLE eventos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  rifa_id       TEXT NOT NULL REFERENCES rifas (id),
  tipo          TEXT NOT NULL,
  datos         TEXT,
  hash_anterior TEXT,
  hash          TEXT NOT NULL,
  creado_en     INTEGER NOT NULL
);
CREATE INDEX eventos_rifa ON eventos (rifa_id, id);
