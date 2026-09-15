import { describe, expect, it } from "vitest";
import { sha256 } from "@rifaclara/shared";
import { lineasPlataforma } from "../src/cierre";
import { nombreDe } from "../src/lista";

describe("cierre de una rifa", () => {
  it("congela la lista en orden numérico con la huella del código mostrado", async () => {
    const lineas = await lineasPlataforma([
      { numero: "047", codigo: "abcde23456" },
      { numero: "007", codigo: "abcde23456" },
      { numero: "100", codigo: "zzzzz99999" },
    ]);
    const a = await sha256("RC-ABCDE-23456");
    const z = await sha256("RC-ZZZZZ-99999");
    expect(lineas).toEqual([`007:${a}`, `047:${a}`, `100:${z}`]);
    // La lista no expone el código: solo quien lo tiene reconoce su línea.
    expect(lineas.join("\n")).not.toContain("ABCDE");
  });

  it("muestra el número de cada línea de la plataforma", async () => {
    expect(nombreDe(`047:${await sha256("x")}`, "plataforma")).toBe("047");
  });
});
