import { describe, expect, it } from "vitest";
import { esquemaReserva, leerCodigo, mostrarCodigo, normalizarTelefono } from "../src/reservas";

describe("reservas", () => {
  it("normaliza teléfonos chilenos", () => {
    expect(normalizarTelefono("9 1234 5678")).toBe("56912345678");
    expect(normalizarTelefono("+56 9 1234 5678")).toBe("56912345678");
    expect(normalizarTelefono("+54 11 5555 1234")).toBe("541155551234");
  });

  it("muestra y lee el código del boleto", () => {
    expect(mostrarCodigo("abcde23456")).toBe("RC-ABCDE-23456");
    expect(leerCodigo("RC-ABCDE-23456")).toBe("abcde23456");
    expect(leerCodigo("rcabcde23456")).toBe("abcde23456");
  });

  it("valida la reserva", () => {
    const ok = esquemaReserva.parse({ numeros: ["007", "047"], nombre: " Camila ", telefono: "9 1234 5678" });
    expect(ok).toMatchObject({ nombre: "Camila", telefono: "56912345678" });
    const error = (d: unknown) => esquemaReserva.safeParse(d).error?.issues[0]?.message;
    expect(error({ numeros: [], nombre: "Ana", telefono: "912345678" })).toMatch(/al menos un número/);
    expect(error({ numeros: ["01"], nombre: "A", telefono: "912345678" })).toMatch(/nombre/);
    expect(error({ numeros: ["01"], nombre: "Ana", telefono: "123" })).toMatch(/WhatsApp/);
  });
});
