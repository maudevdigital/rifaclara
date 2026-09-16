-- Fase 3 paso 5: sello del registro de la rifa en la cadena de Bitcoin.
-- El archivo del registro y su comprobante .ots viven en R2, con claves fijas
-- (rifas/{id}/registro.json y rifas/{id}/registro.ots); aquí queda el estado.

ALTER TABLE rifas ADD COLUMN sello_estado TEXT;        -- NULL, pendiente, sellado
ALTER TABLE rifas ADD COLUMN sello_en INTEGER;
ALTER TABLE rifas ADD COLUMN sello_huella TEXT;        -- sha256 del registro sellado
ALTER TABLE rifas ADD COLUMN sello_calendarios TEXT;   -- JSON con los calendarios que respondieron

CREATE INDEX rifas_sello ON rifas (sello_estado, estado);
