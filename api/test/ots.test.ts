import { describe, expect, it } from "vitest";
import { aHex, archivoOts, digestDe } from "../src/ots";

const CABECERA = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294";
const digest = new Uint8Array(32).fill(7);

describe("comprobante OpenTimestamps", () => {
  it("arma el archivo con la cabecera, la versión y la huella", async () => {
    const respuesta = new Uint8Array([0xf0, 0x02, 0xaa, 0xbb, 0x08]);
    const hex = aHex(archivoOts(digest, [respuesta]));
    // cabecera mágica · versión 1 · operación sha256 (0x08) · huella · respuesta del calendario
    expect(hex).toBe(`${CABECERA}0108${aHex(digest)}${aHex(respuesta)}`);
  });

  it("separa las ramas cuando responden dos calendarios", () => {
    const a = new Uint8Array([0xf0, 0x01, 0x01]);
    const b = new Uint8Array([0xf0, 0x01, 0x02]);
    const hex = aHex(archivoOts(digest, [a, b]));
    // La marca 0xff va antes de todas las ramas menos la última.
    expect(hex).toBe(`${CABECERA}0108${aHex(digest)}ff${aHex(a)}${aHex(b)}`);
  });

  it("no arma nada sin huella válida ni sin respuestas", () => {
    expect(() => archivoOts(new Uint8Array(16), [new Uint8Array([1])])).toThrow(/32 bytes/);
    expect(() => archivoOts(digest, [])).toThrow(/ningún sello/);
  });

  it("calcula la huella sha256 de lo que sella", async () => {
    // sha256("abc"), el ejemplo de manual.
    expect(aHex(await digestDe("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
