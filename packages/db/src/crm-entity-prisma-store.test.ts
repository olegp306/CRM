import { describe, expect, it } from "vitest";
import { createCrmEntityPrismaStore } from "./crm-entity-prisma-store";

describe("crm entity prisma store", () => {
  it("persists extracted lead entities and calendar actions in one call", async () => {
    const calls: Array<{ model: string; method: string; args: unknown }> = [];
    const client = {
      leadContextEntity: {
        createMany: async (args: unknown) => {
          calls.push({ model: "leadContextEntity", method: "createMany", args });
          return { count: 2 };
        }
      },
      crmCalendarAction: {
        createMany: async (args: unknown) => {
          calls.push({ model: "crmCalendarAction", method: "createMany", args });
          return { count: 1 };
        }
      },
      auditLog: {
        createMany: async (args: unknown) => {
          calls.push({ model: "auditLog", method: "createMany", args });
          return { count: 1 };
        }
      }
    };

    const store = createCrmEntityPrismaStore(client);
    await store.saveLeadEntityExtraction({
      workspaceId: "workspace-1",
      leadRecordId: "lead-record-1",
      leadId: "L-2026-001",
      sourceChannel: "telegram",
      sourceMessageId: "message-1",
      actorUserId: "telegram:123",
      entities: [
        { type: "FACT", label: "Interest", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" },
        {
          type: "TAG",
          label: "jazz",
          value: "interest_jazz",
          sourceText: "likes jazz",
          confidence: "high",
          normalizedKey: "interest_jazz"
        }
      ],
      calendarActions: [
        {
          title: "Call Artem",
          description: "Ask about documents",
          dueAt: new Date("2026-06-03T09:00:00.000Z"),
          recurrence: "none"
        }
      ],
      summary: "Saved CRM context."
    });

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual([
      "leadContextEntity.createMany",
      "crmCalendarAction.createMany",
      "auditLog.createMany"
    ]);
    expect(JSON.stringify(calls[0].args)).toContain("interest_jazz");
    expect(JSON.stringify(calls[1].args)).toContain("Call Artem");
    expect(JSON.stringify(calls[2].args)).toContain("lead.entity_extraction_saved");
  });
});
