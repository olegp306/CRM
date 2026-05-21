import { describe, expect, it } from "vitest";
import { getDueFollowups, type FollowupListItem } from "./due-followups";

const items: FollowupListItem[] = [
  {
    id: "followup-1",
    workspaceId: "workspace-1",
    followupId: "F-20260520-message-1",
    dueDate: new Date("2026-05-20T09:00:00.000Z"),
    status: "pending",
    rawInput: "Follow up with lead L-2026-001",
    requestedByUserId: "user-1"
  },
  {
    id: "followup-2",
    workspaceId: "workspace-1",
    followupId: "F-20260523-message-2",
    dueDate: new Date("2026-05-23T09:00:00.000Z"),
    status: "pending",
    rawInput: "Future follow-up",
    requestedByUserId: "user-1"
  },
  {
    id: "followup-3",
    workspaceId: "workspace-2",
    followupId: "F-20260520-message-3",
    dueDate: new Date("2026-05-20T09:00:00.000Z"),
    status: "pending",
    rawInput: "Other workspace",
    requestedByUserId: "user-2"
  },
  {
    id: "followup-4",
    workspaceId: "workspace-1",
    followupId: "F-20260520-message-4",
    dueDate: new Date("2026-05-20T09:00:00.000Z"),
    status: "done",
    rawInput: "Already done",
    requestedByUserId: "user-1"
  }
];

describe("getDueFollowups", () => {
  it("returns pending follow-ups due today or earlier for one workspace", () => {
    expect(getDueFollowups(items, { workspaceId: "workspace-1", today: new Date("2026-05-21T12:00:00.000Z") })).toEqual([
      items[0]
    ]);
  });
});
