import { describe, expect, it } from "vitest";
import { esquemaNuevoSorteo, generarId, lineasDe, nombreDe } from "../src/lista";

describe("lista de un sorteo", () => {
  it("numera las líneas con ceros según el total", () => {
    expect(lineasDe(["Ana", "Beto"])).toEqual(["0:Ana", "1:Beto"]);
    expect(lineasDe(Array.from({ length: 12 }, (_, i) => `N${i}`))[3]).toBe("03:N3");
  });

  it("recupera el nombre aunque tenga dos puntos", () => {
    expect(nombreDe("07:Equipo: los azules")).toBe("Equipo: los azules");
  });

  it("valida y limpia la entrada", () => {
    const ok = esquemaNuevoSorteo.parse({ nombres: ["  Ana ", "Beto"] });
    expect(ok).toEqual({ nombres: ["Ana", "Beto"], tipo: "ruleta" });
    expect(esquemaNuevoSorteo.safeParse({ nombres: ["Ana"] }).error?.issues[0]?.message).toMatch(/al menos dos/);
    expect(esquemaNuevoSorteo.safeParse({ nombres: ["Ana", " "] }).error?.issues[0]?.message).toMatch(/vacía/);
    expect(esquemaNuevoSorteo.safeParse({ nombres: Array(501).fill("x") }).success).toBe(false);
    expect(esquemaNuevoSorteo.safeParse(null).success).toBe(false);
  });
});

describe("ids", () => {
  it("tienen 10 caracteres sin letras confusas", () => {
    for (let i = 0; i < 200; i++) expect(generarId()).toMatch(/^[2-9a-hj-km-np-z]{10}$/);
  });
});
