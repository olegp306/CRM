import { describe, expect, it } from "vitest";
import { createActionPreview } from "./action-preview";

describe("createActionPreview", () => {
  it("creates a stable preview for create lead actions", () => {
    expect(
      createActionPreview({
        actionType: "create_lead",
        summary: "Create lead for Anna Beispiel",
        changes: [
          { field: "client.name", from: null, to: "Anna Beispiel" },
          { field: "lead.bgfM2", from: null, to: 150 }
        ],
        warnings: ["Missing desired move-in date"]
      })
    ).toEqual({
      actionType: "create_lead",
      summary: "Create lead for Anna Beispiel",
      changes: [
        { field: "client.name", from: null, to: "Anna Beispiel" },
        { field: "lead.bgfM2", from: null, to: 150 }
      ],
      warnings: ["Missing desired move-in date"],
      requiresConfirmation: true
    });
  });
});
