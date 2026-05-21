import { describe, expect, it } from "vitest";
import { validateClientInput } from "./client-validation";

describe("validateClientInput", () => {
  it("normalizes valid client input", () => {
    expect(
      validateClientInput({
        name: "  Anna Beispiel  ",
        clientType: "private",
        email: " ANNA@EXAMPLE.COM ",
        phone: " +49 30 123 ",
        language: "de"
      })
    ).toEqual({
      ok: true,
      value: {
        name: "Anna Beispiel",
        clientType: "private",
        email: "anna@example.com",
        phone: "+49 30 123",
        language: "de"
      }
    });
  });

  it("reports required and dictionary validation errors", () => {
    expect(validateClientInput({ name: "", clientType: "unknown" })).toEqual({
      ok: false,
      errors: [
        { field: "name", message: "Client name is required" },
        { field: "clientType", message: "Client type is not supported" }
      ]
    });
  });
});
