import { describe, expect, it } from "vitest";
import { baseDeSlug, esquemaNuevaRifa, numerosDeRifa } from "../src/rifas-esquema";
import { aleatorio } from "../src/auth";

const enUnaSemana = Math.floor(Date.now() / 1000) + 7 * 86400;
const valida = {
  titulo: "Rifa Bomberos 3ª Compañía",
  premios: ["TV 55\"", "Canasta familiar"],
  precio: 2000,
  desde: 1,
  hasta: 100,
  mediosPago: "Transferencia a Cuenta RUT 12.345.678-9",
  whatsapp: "+56 9 1234 5678",
  cierreEn: enUnaSemana,
  declaracion: true,
};
const error = (d: unknown) => esquemaNuevaRifa.safeParse(d).error?.issues[0]?.message;

describe("nueva rifa", () => {
  it("acepta una rifa válida y limpia el WhatsApp", () => {
    const r = esquemaNuevaRifa.parse(valida);
    expect(r.whatsapp).toBe("56912345678");
    expect(r.horasReserva).toBe(24);
    expect(r.maxPorPersona).toBe(10);
  });

  it("aplica los límites del plan gratuito", () => {
    expect(error({ ...valida, hasta: 150 })).toMatch(/hasta 100/);
    expect(error({ ...valida, desde: 1, hasta: 5 })).toMatch(/al menos 10/);
    expect(error({ ...valida, desde: 50, hasta: 10 })).toMatch(/mayor que/);
    expect(esquemaNuevaRifa.safeParse({ ...valida, desde: 0, hasta: 99 }).success).toBe(true);
  });

  it("valida fechas, premios, precio y declaración", () => {
    expect(error({ ...valida, cierreEn: Math.floor(Date.now() / 1000) + 60 })).toMatch(/una hora/);
    expect(error({ ...valida, cierreEn: enUnaSemana + 400 * 86400 })).toMatch(/6 meses/);
    expect(error({ ...valida, premios: [] })).toMatch(/al menos un premio/);
    expect(error({ ...valida, precio: 50 })).toMatch(/mínimo/);
    expect(error({ ...valida, declaracion: false })).toMatch(/declaración/);
    expect(error({ ...valida, whatsapp: "123" })).toMatch(/WhatsApp/);
    expect(esquemaNuevaRifa.safeParse({ ...valida, whatsapp: "" }).success).toBe(true);
  });
});

describe("utilidades", () => {
  it("arma slugs legibles", () => {
    expect(baseDeSlug("Rifa Bomberos 3ª Compañía")).toBe("rifa-bomberos-3a-compania");
    expect(baseDeSlug("¡¡¡!!!")).toBe("rifa");
  });

  it("numera con el mismo ancho", () => {
    expect(numerosDeRifa(1, 100).slice(0, 2)).toEqual(["001", "002"]);
    expect(numerosDeRifa(0, 99).at(-1)).toBe("99");
  });

  it("genera tokens distintos de 43 caracteres", () => {
    const a = aleatorio(), b = aleatorio();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
