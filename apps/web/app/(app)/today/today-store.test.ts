import { describe, expect, it } from "vitest";
import {
  createTodayCalendarActionViewModel,
  createTodayCalendarViewModel,
  createTodayFollowupViewModel,
  createLeadFollowupCalendarItems,
  createWorkspaceCalendarItems
} from "./today-store";

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
        status: "pending",
        source: "assistant_followup"
      }
    ]);
  });
});

describe("workspace calendar view model", () => {
  it("builds all workspace calendar items with lead links and today's actions", () => {
    const items = createWorkspaceCalendarItems(
      [
        {
          id: "calendar-action-1",
          workspaceId: "workspace-1",
          leadRecordId: "lead-record-1",
          lead: { leadId: "L-2026-001", displayName: "Artem - Neubau EFH" },
          title: "Call Artem",
          description: "Ask for investor update",
          dueAt: new Date("2026-05-21T09:00:00.000Z"),
          recurrence: "none",
          status: "planned",
          sourceChannel: "telegram",
          actorUserId: "telegram:12345"
        },
        {
          id: "calendar-action-2",
          workspaceId: "workspace-1",
          leadRecordId: "lead-record-1",
          lead: { leadId: "L-2026-001", displayName: "Artem - Neubau EFH" },
          title: "Birthday",
          description: "Congratulate client",
          dueAt: new Date("2026-06-14T09:00:00.000Z"),
          recurrence: "yearly",
          status: "planned"
        }
      ],
      { workspaceId: "workspace-1" }
    );
    const calendar = createTodayCalendarViewModel(items, new Date("2026-05-21T12:00:00.000Z"));

    expect(calendar.initialMonth).toBe("2026-05");
    expect(calendar.todayItems).toHaveLength(1);
    expect(calendar.items.map((item) => item.leadId)).toEqual(["L-2026-001", "L-2026-001"]);
    expect(calendar.items[1]).toMatchObject({ kind: "birthday", badgeLabel: "DR yearly" });
  });

  it("includes ordinary lead follow-up dates in the shared workspace calendar", () => {
    const items = createLeadFollowupCalendarItems([
      {
        id: "lead-record-777",
        leadId: "L-2026-777",
        displayName: "Frau Schneider - Neubau EFH am Chiemsee",
        followup1Date: "2026-06-05T09:00:00.000Z",
        followupStatus: "planned",
        outcome: null
      },
      {
        id: "lead-record-done",
        leadId: "L-2026-778",
        displayName: "Closed lead",
        followup1Date: "2026-06-06T09:00:00.000Z",
        followupStatus: "planned",
        outcome: "contract"
      }
    ]);
    const calendar = createTodayCalendarViewModel(items, new Date("2026-06-01T12:00:00.000Z"));

    expect(calendar.items).toEqual([
      expect.objectContaining({
        id: "lead-followup-lead-record-777-2026-06-05",
        date: "2026-06-05",
        kind: "followup",
        leadId: "L-2026-777",
        leadName: "Frau Schneider - Neubau EFH am Chiemsee"
      })
    ]);
    expect(calendar.nextSummary).toBe("Next: 2026-06-05 - Follow up (Frau Schneider - Neubau EFH am Chiemsee)");
  });
});

describe("createTodayCalendarActionViewModel", () => {
  it("maps extracted CRM calendar actions into due follow-up rows", () => {
    expect(
      createTodayCalendarActionViewModel(
        [
          {
            id: "calendar-action-1",
            workspaceId: "workspace-1",
            leadRecordId: "lead-record-1",
            lead: { leadId: "L-2026-001" },
            title: "Call Artem",
            description: "Ask for investor update",
            dueAt: new Date("2026-05-20T09:00:00.000Z"),
            recurrence: "none",
            actorUserId: "telegram:12345"
          }
        ],
        { workspaceId: "workspace-1", today: new Date("2026-05-21T12:00:00.000Z") }
      )
    ).toEqual([
      {
        id: "calendar-action-1",
        followupId: "Call Artem",
        dueDateLabel: "2026-05-20",
        rawInput: "Ask for investor update",
        requestedByUserId: "telegram:12345",
        status: "pending",
        leadId: "L-2026-001",
        source: "crm_entity_extractor"
      }
    ]);
  });
});
