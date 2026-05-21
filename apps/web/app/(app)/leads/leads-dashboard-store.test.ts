import { describe, expect, it } from "vitest";
import { createLeadsDashboardViewModel } from "./leads-dashboard-store";

describe("createLeadsDashboardViewModel", () => {
  it("builds metrics and lanes for assistant-created leads", () => {
    const viewModel = createLeadsDashboardViewModel([
      {
        id: "lead-record-1",
        workspaceId: "workspace-1",
        leadId: "L-2026-001",
        status: "new",
        rawInput: "Anna Beispiel, BGF 150 m2"
      },
      {
        id: "lead-record-2",
        workspaceId: "workspace-1",
        leadId: "L-2026-002",
        status: "new",
        rawInput: "Generate KP for Fam. Muller"
      },
      {
        id: "lead-record-3",
        workspaceId: "workspace-1",
        leadId: "L-2026-003",
        status: "new",
        rawInput: "Follow up after KP"
      }
    ]);

    expect(viewModel.total).toBe(3);
    expect(viewModel.newCount).toBe(1);
    expect(viewModel.kpCount).toBe(1);
    expect(viewModel.followupCount).toBe(1);
    expect(viewModel.lanes.map((lane) => [lane.id, lane.cards.length])).toEqual([
      ["new", 1],
      ["qualifying", 0],
      ["kp", 1],
      ["followup", 1]
    ]);
  });
});
