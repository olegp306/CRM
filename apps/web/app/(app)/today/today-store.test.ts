import { describe, expect, it } from "vitest";
import { createTodayFollowupViewModel } from "./today-store";

describe("createTodayFollowupViewModel", () => {
  it("maps assistant follow-ups into due follow-up rows", () => {
    expect(
      createTodayFollowupViewModel(
        [
          {
            id: "record-1",
            workspaceId: "workspace-1",
            followupId: "F-20260520-message-1",
            rawInput: "Follow up with lead L-2026-001",
            requestedByUserId: "user-1"
          }
        ],
        { workspaceId: "workspace-1", today: new Date("2026-05-21T12:00:00.000Z") }
      )
    ).toEqual([
      {
        id: "record-1",
        followupId: "F-20260520-message-1",
        dueDateLabel: "2026-05-20",
        rawInput: "Follow up with lead L-2026-001",
        requestedByUserId: "user-1",
        status: "pending"
      }
    ]);
  });
});
