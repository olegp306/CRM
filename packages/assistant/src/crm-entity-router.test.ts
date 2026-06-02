import { describe, expect, it } from "vitest";
import { createCrmEntityPersistencePlan } from "./crm-entity-router";

describe("crm entity router", () => {
  it("routes facts, people, organizations, and tags into lead context entities", () => {
    const plan = createCrmEntityPersistencePlan({
      leadId: "L-2026-001",
      extraction: {
        facts: [{ type: "FACT", label: "Interest", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" }],
        people: [{ type: "PERSON", label: "Artem", value: "Artem", sourceText: "Artem", confidence: "high" }],
        organizations: [],
        tags: [
          {
            type: "TAG",
            label: "jazz",
            value: "interest_jazz",
            normalizedKey: "interest_jazz",
            sourceText: "jazz",
            confidence: "high"
          }
        ],
        events: [],
        followups: [],
        leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
        confidence: { overall: "high" },
        summary: "Saved context."
      }
    });

    expect(plan.entities.map((entity) => entity.type)).toEqual(["FACT", "PERSON", "TAG"]);
    expect(plan.calendarActions).toEqual([]);
    expect(plan.historySummary).toContain("Saved context");
  });

  it("routes follow-ups and events into calendar actions", () => {
    const plan = createCrmEntityPersistencePlan({
      leadId: "L-2026-001",
      extraction: {
        facts: [],
        people: [],
        organizations: [],
        tags: [],
        events: [
          {
            type: "EVENT",
            label: "Birthday",
            value: "Birthday",
            startsAt: "2026-06-14T09:00:00.000Z",
            recurrence: "yearly",
            sourceText: "birthday 14 June",
            confidence: "high"
          }
        ],
        followups: [
          {
            type: "FOLLOW_UP",
            label: "Call",
            value: "Call client",
            title: "Call client",
            dueAt: "2026-06-03T09:00:00.000Z",
            recurrence: "none",
            assigneeHint: null,
            sourceText: "call tomorrow",
            confidence: "high"
          }
        ],
        leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
        confidence: { overall: "high" },
        summary: "Created future actions."
      }
    });

    expect(plan.calendarActions).toHaveLength(2);
    expect(plan.calendarActions[0]).toMatchObject({ title: "Call client", recurrence: "none" });
    expect(plan.calendarActions[1]).toMatchObject({ title: "Birthday", recurrence: "yearly" });
  });
});
