-- Varios premios por sorteo (rifas). `ganadores` guarda las líneas ganadoras
-- en orden de premio como JSON; `ganador` queda como el primer premio.
ALTER TABLE sorteos ADD COLUMN premios INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sorteos ADD COLUMN ganadores TEXT;
