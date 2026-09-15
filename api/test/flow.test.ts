import { describe, expect, it } from "vitest";
import { firmarFlow } from "../src/flow";

describe("firma de Flow", () => {
  it("ordena los parámetros y firma con HMAC-SHA256", async () => {
    // Vector calculado aparte: HMAC-SHA256("secreto", "amount5990apiKeyABCcommerceOrderrc-1")
    const firma = await firmarFlow({ commerceOrder: "rc-1", apiKey: "ABC", amount: "5990" }, "secreto");
    expect(firma).toBe("b17990912bbf377b3ebc87a4de3ae3ce670998274e018fedca8a8cbe9b7482bb");
    // Cambiar el orden de entrada no cambia la firma.
    expect(await firmarFlow({ amount: "5990", apiKey: "ABC", commerceOrder: "rc-1" }, "secreto")).toBe(firma);
    expect(await firmarFlow({ amount: "5991", apiKey: "ABC", commerceOrder: "rc-1" }, "secreto")).not.toBe(firma);
  });
});
