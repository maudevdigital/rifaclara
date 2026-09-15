import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatearNumero, lineaBoleto, momentoRonda, rondaDrand, sortear, DRAND_QUICKNET } from "../src";

// Implementación de referencia con node:crypto, escrita aparte a partir de la
// especificación. Si alguien cambia el algoritmo, estas pruebas lo delatan.
const ref = (s: string) => createHash("sha256").update(s).digest("hex");
function sortearRef(azar: string, rifaId: string, lista: string[], premios: number) {
  const huella = ref(lista.join("\n"));
  const quedan = [...lista];
  const ganadores: string[] = [];
  for (let p = 0; p < premios; p++) {
    const i = Number(BigInt("0x" + ref(`${azar}:${rifaId}:${huella}:${p}`)) % BigInt(quedan.length));
    ganadores.push(quedan.splice(i, 1)[0]!);
  }
  return { huella, ganadores };
}

const AZAR = "8f2c1a9e47b35d06c2e1f98a7b4d3c52e6a90f1b8d7c4e3a2b1f0e9d8c7b6a51";
const lista100 = Array.from({ length: 100 }, (_, n) => `${formatearNumero(n, 100)}:${ref("RC-" + n)}`);

describe("sortear", () => {
  it("coincide con la implementación de referencia", async () => {
    for (const premios of [1, 3, 10]) {
      const r = await sortear({ azar: AZAR, rifaId: "bici-aro-29", lista: lista100, premios });
      const esperado = sortearRef(AZAR, "bici-aro-29", lista100, premios);
      expect(r.huella).toBe(esperado.huella);
      expect(r.ganadores.map((g) => g.linea)).toEqual(esperado.ganadores);
    }
  });

  it("no repite ganadores", async () => {
    const r = await sortear({ azar: AZAR, rifaId: "x", lista: lista100, premios: 100 });
    expect(new Set(r.ganadores.map((g) => g.linea)).size).toBe(100);
  });

  it("cambia si cambia la rifa o el azar", async () => {
    const base = await sortear({ azar: AZAR, rifaId: "a", lista: lista100, premios: 5 });
    const otraRifa = await sortear({ azar: AZAR, rifaId: "b", lista: lista100, premios: 5 });
    const otroAzar = await sortear({ azar: AZAR.replace(/^8/, "9"), rifaId: "a", lista: lista100, premios: 5 });
    expect(otraRifa.ganadores).not.toEqual(base.ganadores);
    expect(otroAzar.ganadores).not.toEqual(base.ganadores);
  });

  it("rechaza entradas inválidas", async () => {
    await expect(sortear({ azar: "abc", rifaId: "a", lista: lista100, premios: 1 })).rejects.toThrow(/64 caracteres/);
    await expect(sortear({ azar: AZAR, rifaId: "a", lista: ["1", "2"], premios: 3 })).rejects.toThrow(/solo 2 boletos/);
    await expect(sortear({ azar: AZAR, rifaId: "a", lista: ["1", "1"], premios: 1 })).rejects.toThrow(/repetidas/);
    await expect(sortear({ azar: AZAR, rifaId: "a", lista: lista100, premios: 0 })).rejects.toThrow(/al menos un premio/);
  });
});

describe("rondas de drand", () => {
  it("la ronda 1 es el génesis y avanza cada 3 s", () => {
    expect(rondaDrand(DRAND_QUICKNET.genesis)).toBe(1);
    expect(rondaDrand(DRAND_QUICKNET.genesis + 1)).toBe(2);
    expect(rondaDrand(DRAND_QUICKNET.genesis + 3)).toBe(2);
    expect(momentoRonda(2)).toBe(DRAND_QUICKNET.genesis + 3);
  });

  it("20 sep 2026 20:05 en Chile es la ronda 32380712", () => {
    const t = Date.parse("2026-09-20T23:05:00Z") / 1000;
    expect(rondaDrand(t)).toBe(32380712);
    expect(momentoRonda(32380712)).toBeGreaterThanOrEqual(t);
  });
});

describe("boletos", () => {
  it("formatea con ceros según el total", () => {
    expect(formatearNumero(7, 100)).toBe("07");
    expect(formatearNumero(7, 1000)).toBe("007");
    expect(formatearNumero(7, 10)).toBe("7");
  });

  it("la línea pública no contiene el código", async () => {
    const linea = await lineaBoleto("07", "RC-7K2M");
    expect(linea).toBe(`07:${ref("RC-7K2M")}`);
    expect(linea).not.toContain("RC-7K2M");
  });
});
