-- Copia de los números de cada reserva, para mostrarlos en el boleto aunque la
-- reserva haya vencido o se haya liberado (entonces ya no están en `numeros`).
ALTER TABLE reservas ADD COLUMN numeros TEXT NOT NULL DEFAULT '[]';
