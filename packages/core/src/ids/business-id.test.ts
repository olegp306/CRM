import { describe, expect, it } from "vitest";
import { getNextBusinessId } from "./business-id";

describe("getNextBusinessId", () => {
  it("generates client, lead, and project ids with year and padded sequence", () => {
    const now = new Date("2026-05-21T00:00:00.000Z");

    expect(getNextBusinessId({ kind: "client", now, existingIds: [] })).toBe("C-2026-001");
    expect(getNextBusinessId({ kind: "lead", now, existingIds: [] })).toBe("L-2026-001");
    expect(getNextBusinessId({ kind: "project", now, existingIds: [] })).toBe("P-2026-001");
  });

  it("increments only ids for the current year", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");

    expect(getNextBusinessId({ kind: "lead", now, existingIds: ["L-2025-099", "L-2026-002"] })).toBe("L-2026-003");
  });

  it("keeps workspace separation by using only the scoped existing ids provided by caller", () => {
    const now = new Date("2026-07-10T00:00:00.000Z");

    const workspaceA = getNextBusinessId({ kind: "project", now, existingIds: ["P-2026-004"] });
    const workspaceB = getNextBusinessId({ kind: "project", now, existingIds: [] });

    expect(workspaceA).toBe("P-2026-005");
    expect(workspaceB).toBe("P-2026-001");
  });
});
