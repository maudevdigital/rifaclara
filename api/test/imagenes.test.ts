import { describe, expect, it } from "vitest";
import { detectarTipo } from "../src/imagenes";

const bytes = (...b: (number | string)[]) =>
  new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((ch) => ch.charCodeAt(0)) : [x])));

describe("detectarTipo", () => {
  it("reconoce JPEG, PNG y WebP por su contenido", () => {
    expect(detectarTipo(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectarTipo(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("image/png");
    expect(detectarTipo(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("image/webp");
  });

  it("rechaza lo que no es imagen aunque diga serlo", () => {
    expect(detectarTipo(bytes("<svg xmlns"))).toBeNull();
    expect(detectarTipo(bytes("GIF89a"))).toBeNull();
    expect(detectarTipo(bytes("%PDF-1.7"))).toBeNull();
    expect(detectarTipo(new Uint8Array())).toBeNull();
  });
});
