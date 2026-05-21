import { describe, expect, it } from "vitest";
import { renderDocumentTemplate } from "./render-template";

describe("renderDocumentTemplate", () => {
  it("replaces known placeholders and reports missing values", () => {
    expect(
      renderDocumentTemplate("KP for {{ client_name }} at {{project_address}}. {{missing_value}}", {
        client_name: "Anna Beispiel",
        project_address: "Beispielstrasse 1"
      })
    ).toEqual({
      content: "KP for Anna Beispiel at Beispielstrasse 1. ",
      usedPlaceholders: ["client_name", "missing_value", "project_address"],
      missingPlaceholders: ["missing_value"]
    });
  });
});
