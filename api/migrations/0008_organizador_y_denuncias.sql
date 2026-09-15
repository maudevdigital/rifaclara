-- Fase 3 paso 4: historial público del organizador y denuncias de rifas.

-- Identificador corto para la página pública del organizador (/organizador/:alias).
-- No se usa el id interno para no exponerlo. En SQLite los NULL no chocan entre
-- sí, así que el índice único convive con las cuentas que aún no tienen alias.
ALTER TABLE usuarios ADD COLUMN alias TEXT;
CREATE UNIQUE INDEX usuarios_alias ON usuarios (alias);
UPDATE usuarios SET alias = lower(hex(randomblob(4))) WHERE alias IS NULL;

CREATE TABLE denuncias (
  id          TEXT PRIMARY KEY,
  rifa_id     TEXT NOT NULL REFERENCES rifas (id),
  motivo      TEXT NOT NULL,                  -- no_entrega, estafa, ilegal, datos, otro
  detalle     TEXT,
  contacto    TEXT,                           -- correo o teléfono de quien denuncia (opcional)
  estado      TEXT NOT NULL DEFAULT 'abierta', -- abierta, revisada, descartada
  nota        TEXT,                           -- qué se hizo, lo escribe quien revisa
  creado_en   INTEGER NOT NULL,
  resuelto_en INTEGER
);
CREATE INDEX denuncias_estado ON denuncias (estado, creado_en);
CREATE INDEX denuncias_rifa ON denuncias (rifa_id);
