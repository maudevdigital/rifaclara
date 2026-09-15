import { describe, expect, it } from "vitest";
import { MAX_NUMEROS_RIFA, TRAMOS, tramoPara } from "../src";

describe("precios", () => {
  it("asigna el tramo según la cantidad de números", () => {
    expect(tramoPara(50)?.precio).toBe(0);
    expect(tramoPara(100)?.precio).toBe(0);
    expect(tramoPara(101)?.id).toBe("hasta-500");
    expect(tramoPara(500)?.precio).toBe(4990);
    expect(tramoPara(501)?.precio).toBe(11990);
    expect(tramoPara(2000)?.id).toBe("hasta-2000");
    expect(tramoPara(2001)).toBeNull();
    expect(MAX_NUMEROS_RIFA).toBe(2000);
  });

  it("los tramos crecen en tamaño y precio", () => {
    for (let i = 1; i < TRAMOS.length; i++) {
      expect(TRAMOS[i]!.hasta).toBeGreaterThan(TRAMOS[i - 1]!.hasta);
      expect(TRAMOS[i]!.precio).toBeGreaterThan(TRAMOS[i - 1]!.precio);
    }
  });
});
