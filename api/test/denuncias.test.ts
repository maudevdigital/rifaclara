import { describe, expect, it } from "vitest";
import { MOTIVOS, esquemaDenuncia } from "../src/denuncias";

describe("denuncias", () => {
  it("acepta un reporte con motivo de la lista", () => {
    const d = esquemaDenuncia.parse({ motivo: "no_entrega", detalle: "  Cerró y no responde  " });
    expect(d).toMatchObject({ motivo: "no_entrega", detalle: "Cerró y no responde", contacto: "" });
  });

  it("rechaza motivos inventados y detalles larguísimos", () => {
    const error = (x: unknown) => esquemaDenuncia.safeParse(x).error?.issues[0]?.message;
    expect(error({ motivo: "no_me_gusta" })).toMatch(/Elige un motivo/);
    expect(error({})).toMatch(/Elige un motivo/);
    expect(error({ motivo: "otro", detalle: "x".repeat(601) })).toMatch(/600 caracteres/);
  });

  it("marca el campo trampa cuando lo llena un bot", () => {
    const r = esquemaDenuncia.safeParse({ motivo: "estafa", sitio: "http://spam" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "sitio")).toBe(true);
  });

  it("tiene un texto para cada motivo", () => {
    for (const [clave, texto] of Object.entries(MOTIVOS)) {
      expect(esquemaDenuncia.safeParse({ motivo: clave }).success).toBe(true);
      expect(texto.length).toBeGreaterThan(5);
    }
  });
});
