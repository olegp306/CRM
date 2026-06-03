import { describe, expect, it } from "vitest";
import { createLeadReminderDraft, createReminderHistorySummary, isReminderRequest } from "./lead-reminder";

describe("lead reminder agent", () => {
  it("detects Russian reminder requests", () => {
    expect(isReminderRequest("Напомни завтра посмотреть LinkedIn у клиента")).toBe(true);
    expect(isReminderRequest("Через неделю зафоллоуапить Müller Bau")).toBe(true);
    expect(isReminderRequest("Если Bauamt не ответит до пятницы, позвонить им")).toBe(true);
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

  it("extracts a dated CRM follow-up reminder from real Russian unicode text", () => {
    const draft = createLeadReminderDraft(
      "\u041d\u0430\u043f\u043e\u043c\u043d\u0438 \u0437\u0430\u0432\u0442\u0440\u0430 \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c LinkedIn \u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
      {
        now: new Date("2026-05-26T08:15:00.000Z")
      }
    );

    expect(draft).toMatchObject({
      summary: "\u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c LinkedIn \u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
      dueText: "tomorrow",
      recurrence: null,
      calendarStatus: "crm_followup_scheduled"
    });
    expect(draft.dueAt?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });

  it("extracts explicit time from a dated Russian reminder", () => {
    const draft = createLeadReminderDraft("Напомни 10 июня в 15:30 позвонить клиенту", {
      now: new Date("2026-05-26T08:15:00.000Z")
    });

    expect(draft.summary).toBe("позвонить клиенту");
    expect(draft.dueAt?.toISOString()).toBe("2026-06-10T15:30:00.000Z");
  });

  it("extracts month names and yearly recurrence from real Russian unicode text", () => {
    const draft = createLeadReminderDraft(
      "\u0417\u0430\u043f\u043e\u043c\u043d\u0438: \u043a\u0430\u0436\u0434\u044b\u0439 \u0433\u043e\u0434 10 \u0438\u044e\u043d\u044f \u043f\u043e\u0437\u0434\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0441 \u0434\u043d\u0435\u043c \u0440\u043e\u0436\u0434\u0435\u043d\u0438\u044f",
      {
        now: new Date("2026-05-26T08:15:00.000Z")
      }
    );

    expect(draft.recurrence).toBe("yearly");
    expect(draft.summary).toBe(
      "\u043f\u043e\u0437\u0434\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0441 \u0434\u043d\u0435\u043c \u0440\u043e\u0436\u0434\u0435\u043d\u0438\u044f"
    );
    expect(draft.dueAt?.toISOString()).toBe("2026-06-10T09:00:00.000Z");
  });

  it("extracts relative day offsets and next week reminders", () => {
    expect(
      createLeadReminderDraft("Напомни через 3 дня отправить письмо", {
        now: new Date("2026-05-26T08:15:00.000Z")
      }).dueAt?.toISOString()
    ).toBe("2026-05-29T09:00:00.000Z");

    expect(
      createLeadReminderDraft("Через неделю зафоллоуапить Müller Bau", {
        now: new Date("2026-05-26T08:15:00.000Z")
      }).dueAt?.toISOString()
    ).toBe("2026-06-02T09:00:00.000Z");

    expect(
      createLeadReminderDraft("Schedule next week to call the client", {
        now: new Date("2026-05-26T08:15:00.000Z")
      }).dueAt?.toISOString()
    ).toBe("2026-06-02T09:00:00.000Z");
  });

  it("extracts natural Russian relative day reminders", () => {
    const now = new Date("2026-05-26T08:15:00.000Z");

    expect(
      createLeadReminderDraft(
        "\u0427\u0435\u0440\u0435\u0437 \u0434\u0432\u0430 \u0434\u043d\u044f \u043d\u0430\u043f\u043e\u043c\u043d\u0438 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0438\u043c \u043e \u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u0435",
        { now }
      ).dueAt?.toISOString()
    ).toBe("2026-05-28T09:00:00.000Z");

    const coupleDays = createLeadReminderDraft(
      "\u041d\u0430\u043f\u043e\u043c\u043d\u0438 \u0447\u0435\u0440\u0435\u0437 \u043f\u0430\u0440\u0443 \u0434\u043d\u0435\u0439 \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u044c \u0441\u0447\u0435\u0442",
      { now }
    );

    expect(coupleDays.calendarStatus).toBe("crm_followup_scheduled");
    expect(coupleDays.dueAt?.toISOString()).toBe("2026-05-28T09:00:00.000Z");
  });

  it("extracts Russian next-week weekday reminders with daypart time", () => {
    const draft = createLeadReminderDraft(
      "\u041d\u0430 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u043d\u0435\u0434\u0435\u043b\u0435 \u0432\u043e \u0432\u0442\u043e\u0440\u043d\u0438\u043a \u0432\u0435\u0447\u0435\u0440\u043e\u043c \u043d\u0430\u043f\u043e\u043c\u043d\u0438 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0438\u043c \u043e \u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u0435",
      { now: new Date("2026-05-26T08:15:00.000Z") }
    );

    expect(draft).toMatchObject({
      summary: "\u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0438\u043c \u043e \u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u0435",
      dueText: "\u043d\u0430 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u043d\u0435\u0434\u0435\u043b\u0435 \u0432\u043e \u0432\u0442\u043e\u0440\u043d\u0438\u043a",
      calendarStatus: "crm_followup_scheduled"
    });
    expect(draft.dueAt?.toISOString()).toBe("2026-06-02T17:00:00.000Z");
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
