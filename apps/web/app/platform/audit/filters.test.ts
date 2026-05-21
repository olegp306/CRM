import { describe, expect, it } from "vitest";
import { parsePlatformAuditFilters, platformAuditActionFilters } from "./filters";

describe("parsePlatformAuditFilters", () => {
  it("accepts supported audit action, actor, and query values", () => {
    expect(
      parsePlatformAuditFilters({
        action: "platform.release.planned",
        actor: " user-1 ",
        q: " 0.1.0 "
      })
    ).toEqual({
      action: "platform.release.planned",
      actorUserId: "user-1",
      query: "0.1.0"
    });
  });

  it("ignores unsupported action values", () => {
    expect(parsePlatformAuditFilters({ action: "delete_everything", actor: "", q: "" })).toEqual({});
  });

  it("exposes release planning as a page action filter", () => {
    expect(platformAuditActionFilters).toContain("platform.release.planned");
  });
});
