import { sha256 } from "@rifaclara/shared";

/**
 * Registro de cambios de una rifa que solo crece. Cada evento guarda el hash
 * del anterior: si alguien borra o edita uno, la cadena deja de calzar.
 * Devuelve la sentencia para poder incluirla en un batch.
 */
export async function eventoRifa(db: D1Database, rifaId: string, tipo: string, datos: unknown) {
  const previo = await db.prepare("SELECT hash FROM eventos WHERE rifa_id = ? ORDER BY id DESC LIMIT 1")
    .bind(rifaId).first<{ hash: string }>();
  const creado = Math.floor(Date.now() / 1000);
  const json = JSON.stringify(datos ?? null);
  const hash = await sha256(`${previo?.hash ?? ""}|${tipo}|${json}|${creado}`);
  return db.prepare("INSERT INTO eventos (rifa_id, tipo, datos, hash_anterior, hash, creado_en) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(rifaId, tipo, json, previo?.hash ?? null, hash, creado);
}
