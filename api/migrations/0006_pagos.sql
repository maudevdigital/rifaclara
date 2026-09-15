-- Pagos de rifas de más de 100 números, cobrados con Flow.
-- `id` es el commerceOrder que se envía a Flow.
CREATE TABLE pagos (
  id          TEXT PRIMARY KEY,
  rifa_id     TEXT NOT NULL REFERENCES rifas (id),
  usuario_id  TEXT NOT NULL REFERENCES usuarios (id),
  tramo       TEXT NOT NULL,
  monto       INTEGER NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, pagado, rechazado, anulado
  flow_token  TEXT UNIQUE,
  flow_order  INTEGER,
  medio       TEXT,
  creado_en   INTEGER NOT NULL,
  pagado_en   INTEGER
);
CREATE INDEX pagos_rifa ON pagos (rifa_id);
