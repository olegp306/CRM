import { describe, expect, it } from "vitest";
import { createLeadReminderDraft, createReminderHistorySummary, isReminderRequest } from "./lead-reminder";

describe("lead reminder agent", () => {
  it("detects Russian reminder requests", () => {
    expect(isReminderRequest("Напомни завтра посмотреть LinkedIn у клиента")).toBe(true);
  });

  it("extracts a dated CRM follow-up reminder from Russian text", () => {
    const draft = createLeadReminderDraft("Напомни завтра посмотреть LinkedIn у клиента", {
      now: new Date("2026-05-26T08:15:00.000Z")
    });

    expect(draft).toMatchObject({
      summary: "посмотреть LinkedIn у клиента",
      dueText: "tomorrow",
      recurrence: null,
      calendarStatus: "crm_followup_scheduled"
    });
    expect(draft.dueAt?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });

  it("extracts yearly reminder context without pretending it is an ordinary one-off date", () => {
    const draft = createLeadReminderDraft("Запомни: каждый год 10 июня поздравить клиента с днем рождения", {
      now: new Date("2026-05-26T08:15:00.000Z")
    });

    expect(draft.recurrence).toBe("yearly");
    expect(draft.summary).toBe("поздравить клиента с днем рождения");
    expect(draft.dueAt?.toISOString()).toBe("2026-06-10T09:00:00.000Z");
  });

  it("asks for a date when the reminder has no schedulable time", () => {
    const draft = createLeadReminderDraft("Напомни позвонить клиенту", {
      now: new Date("2026-05-26T08:15:00.000Z")
    });

    expect(draft).toMatchObject({
      summary: "позвонить клиенту",
      dueAt: null,
      dueText: null,
      calendarStatus: "needs_date"
    });
  });

  it("formats readable history summaries with calendar status", () => {
    const summary = createReminderHistorySummary("Напомни завтра позвонить клиенту", {
      now: new Date("2026-05-26T08:15:00.000Z")
    });

    expect(summary).toBe("Reminder scheduled: позвонить клиенту. Due: 2026-05-27 09:00.");
  });
});
