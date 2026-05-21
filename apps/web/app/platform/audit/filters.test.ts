import { describe, expect, it } from "vitest";
import { parsePlatformAuditFilters } from "./filters";

describe("parsePlatformAuditFilters", () => {
  it("accepts supported audit action, actor, and query values", () => {
    expect(
      parsePlatformAuditFilters({
        action: "assistant.action.executed",
        actor: " user-1 ",
        q: " generate_kp "
      })
    ).toEqual({
      action: "assistant.action.executed",
      actorUserId: "user-1",
      query: "generate_kp"
    });
  });

  it("ignores unsupported action values", () => {
    expect(parsePlatformAuditFilters({ action: "delete_everything", actor: "", q: "" })).toEqual({});
  });
});
