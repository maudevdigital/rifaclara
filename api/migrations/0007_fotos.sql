-- Foto del premio y tarjeta para compartir (og:image) de cada rifa.
-- Guardan la clave del objeto en el bucket R2 rifaclara-fotos.
ALTER TABLE rifas ADD COLUMN foto TEXT;
ALTER TABLE rifas ADD COLUMN og TEXT;
