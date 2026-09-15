import { describe, expect, it } from "vitest";
import { azarCoincideConFirma, leerRonda, RELAYS_DRAND } from "../src";

// Ronda real de quicknet, leída el 15 sep 2026 desde api.drand.sh.
const REAL = {
  ronda: 32214280,
  azar: "5408bf82c945bd84cf67b724521cc1f3bff74b7299427d869b8b6fa15b2e479e",
  firma:
    "8c79906025bb713ef13f5867208659444ef2c0a472d1d840e6ec5faaba2d63f13968367a8e290025d72464f56ef0b0a6",
};

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const json = { round: REAL.ronda, randomness: REAL.azar, signature: REAL.firma };
const sinEspera = { esperar: async () => {} };

describe("drand", () => {
  it("el azar real es sha256 de su firma", async () => {
    expect(await azarCoincideConFirma(REAL)).toBe(true);
    expect(await azarCoincideConFirma({ ...REAL, azar: REAL.azar.replace(/^5/, "6") })).toBe(false);
  });

  it("lee de los dos relays y devuelve la ronda", async () => {
    const pedidas: string[] = [];
    const f = (async (url: string) => (pedidas.push(url), respuesta(json))) as typeof fetch;
    expect(await leerRonda(REAL.ronda, { f, ...sinEspera })).toEqual(REAL);
    expect(pedidas).toHaveLength(RELAYS_DRAND.length);
  });

  it("falla si los relays no coinciden", async () => {
    let n = 0;
    const f = (async () => respuesta(n++ === 0 ? json : { ...json, randomness: "0".repeat(64) })) as typeof fetch;
    await expect(leerRonda(REAL.ronda, { f, ...sinEspera })).rejects.toThrow(/no coinciden/);
  });

  it("reintenta mientras la ronda no existe (425)", async () => {
    let n = 0;
    const f = (async () => (n++ < 2 ? respuesta({}, 425) : respuesta(json))) as typeof fetch;
    expect((await leerRonda(REAL.ronda, { f, ...sinEspera })).azar).toBe(REAL.azar);
  });

  it("rechaza un azar que no sale de la firma", async () => {
    const f = (async () => respuesta({ ...json, randomness: "a".repeat(64) })) as typeof fetch;
    await expect(leerRonda(REAL.ronda, { f, ...sinEspera })).rejects.toThrow(/no corresponde/);
  });
});
