import { describe, expect, it } from "vitest";
import { esquemaListaEspera } from "../src/lista-espera";

const valido = { email: " Ana@Colegio.CL ", tipo: "colegio", numeros: "100", pagaria: "tal-vez" };
const error = (d: unknown) => esquemaListaEspera.safeParse(d).error?.issues[0];

describe("lista de espera", () => {
  it("normaliza el correo", () => {
    expect(esquemaListaEspera.parse(valido).email).toBe("ana@colegio.cl");
  });

  it("rechaza datos incompletos con mensajes claros", () => {
    expect(error({ ...valido, email: "ana" })?.message).toMatch(/correo/);
    expect(error({ ...valido, tipo: "empresa" })?.message).toMatch(/quién organiza/);
    expect(error({ ...valido, pagaria: undefined })?.message).toMatch(/pagarías/);
  });

  it("marca como bot a quien llena el campo trampa", () => {
    expect(error({ ...valido, sitio: "http://spam" })?.path[0]).toBe("sitio");
    expect(esquemaListaEspera.safeParse({ ...valido, sitio: "" }).success).toBe(true);
  });
});
