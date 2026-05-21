import { describe, expect, it } from "vitest";
import { validateDocumentTemplate } from "./template-validation";

describe("validateDocumentTemplate", () => {
  it("reports detected placeholders, unknown placeholders, and attention status", () => {
    expect(
      validateDocumentTemplate("Dear {{ client_name }}, project {{ project_address }} uses {{ custom_fee }}.")
    ).toEqual({
      detectedPlaceholders: ["client_name", "custom_fee", "project_address"],
      unknownPlaceholders: ["custom_fee"],
      validationStatus: "needs_attention"
    });
  });

  it("marks a template valid when all placeholders are known", () => {
    expect(validateDocumentTemplate("Total {{ total_net }} plus {{ mwst }}.").validationStatus).toBe("valid");
  });
});
