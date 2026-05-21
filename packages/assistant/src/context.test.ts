import { describe, expect, it } from "vitest";
import { captureAssistantContext } from "./context";

describe("captureAssistantContext", () => {
  it("captures workspace, user, route, role, and selected entity context", () => {
    expect(
      captureAssistantContext({
        workspaceId: "workspace-1",
        userId: "user-1",
        role: "admin",
        route: "/leads",
        module: "leads",
        entity: { type: "lead", id: "lead-1" },
        selectedRecordIds: ["lead-1", "lead-2"]
      })
    ).toEqual({
      workspaceId: "workspace-1",
      userId: "user-1",
      role: "admin",
      route: "/leads",
      module: "leads",
      entity: { type: "lead", id: "lead-1" },
      selectedRecordIds: ["lead-1", "lead-2"]
    });
  });

  it("normalizes optional context fields", () => {
    expect(captureAssistantContext({ workspaceId: "workspace-1", userId: "user-1", role: "viewer", route: "" })).toEqual({
      workspaceId: "workspace-1",
      userId: "user-1",
      role: "viewer",
      route: "/",
      module: "other",
      selectedRecordIds: []
    });
  });
});
