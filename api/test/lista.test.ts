import { describe, expect, it } from "vitest";
import { esquemaNuevoSorteo, generarId, lineasDe, nombreDe } from "../src/lista";

const error = (datos: unknown) => esquemaNuevoSorteo.safeParse(datos).error?.issues[0]?.message;

describe("lista de un sorteo", () => {
  it("numera las líneas de ruleta con ceros según el total", () => {
    expect(lineasDe({ tipo: "ruleta", nombres: ["Ana", "Beto"] })).toEqual(["0:Ana", "1:Beto"]);
    expect(lineasDe({ tipo: "ruleta", nombres: Array.from({ length: 12 }, (_, i) => `N${i}`) })[3]).toBe("03:N3");
  });

  it("en una rifa cada línea es el número", () => {
    expect(lineasDe({ tipo: "rifa", nombres: ["007", "047"] })).toEqual(["007", "047"]);
    expect(nombreDe("047", "rifa")).toBe("047");
  });

  it("recupera el nombre aunque tenga dos puntos", () => {
    expect(nombreDe("07:Equipo: los azules")).toBe("Equipo: los azules");
  });

  it("valida y limpia la entrada", () => {
    expect(esquemaNuevoSorteo.parse({ nombres: ["  Ana ", "Beto"] })).toEqual({ nombres: ["Ana", "Beto"], tipo: "ruleta", premios: 1 });
    expect(error({ nombres: ["Ana"] })).toMatch(/al menos dos/);
    expect(error({ nombres: ["Ana", " "] })).toMatch(/vacía/);
    expect(error({ nombres: Array(501).fill("x") })).toMatch(/hasta 500/);
    expect(esquemaNuevoSorteo.safeParse(null).success).toBe(false);
  });

  it("valida rifas y premios", () => {
    const cien = Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(3, "0"));
    expect(esquemaNuevoSorteo.parse({ tipo: "rifa", nombres: cien, premios: 3 }).premios).toBe(3);
    expect(esquemaNuevoSorteo.safeParse({ tipo: "rifa", nombres: Array.from({ length: 5000 }, (_, i) => String(i)) }).success).toBe(true);
    expect(error({ tipo: "rifa", nombres: ["1", "dos"] })).toMatch(/número/);
    expect(error({ tipo: "rifa", nombres: ["1", "1", "2"] })).toMatch(/repetidos/);
    expect(error({ nombres: ["a", "b"], premios: 2 })).toMatch(/más participantes/);
    expect(error({ tipo: "rifa", nombres: cien, premios: 21 })).toMatch(/hasta 20/);
  });
});

describe("ids", () => {
  it("tienen 10 caracteres sin letras confusas", () => {
    for (let i = 0; i < 200; i++) expect(generarId()).toMatch(/^[2-9a-hj-km-np-z]{10}$/);
  });
});
