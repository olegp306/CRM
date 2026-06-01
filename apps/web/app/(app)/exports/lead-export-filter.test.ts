import { describe, expect, it } from "vitest";
import { createLeadExportWhereFromUrl } from "./lead-export-filter";

describe("lead CSV export filters", () => {
  it("maps Search/Filter Agent query params into the lead export where clause", () => {
    expect(
      createLeadExportWhereFromUrl("workspace-demo", "http://localhost/exports/leads?date=last_month&temperature=warm&status=new", {
        now: new Date("2026-06-10T12:00:00.000Z")
      })
    ).toEqual({
      workspaceId: "workspace-demo",
      archivedAt: null,
      createdDate: {
        gte: new Date("2026-05-01T00:00:00.000Z"),
        lt: new Date("2026-06-01T00:00:00.000Z")
      },
      temperature: "warm",
      status: "new"
    });
  });
});
