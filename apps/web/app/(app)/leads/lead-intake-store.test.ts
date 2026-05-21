import { describe, expect, it } from "vitest";
import type { LeadIntakeDraft } from "@app/core";
import { createLeadRecordFromIntakeDraft, type LeadIntakePrismaClientLike } from "./lead-intake-store";

describe("createLeadRecordFromIntakeDraft", () => {
  it("creates the next lead id and stores manual web lead fields", async () => {
    const created: unknown[] = [];
    const client: LeadIntakePrismaClientLike = {
      lead: {
        findMany: async () => [{ leadId: "L-2026-001" }],
        create: async (args) => {
          created.push(args);
          return {
            id: "lead-record-2",
            leadId: "L-2026-002",
            status: "new",
            rawInput: "Manual note",
            requestType: "new_build",
            projectAddress: "Beispielstrasse 1"
          };
        }
      }
    };

    const draft: LeadIntakeDraft = {
      source: "web",
      clientName: "Anna Beispiel",
      email: "anna@example.com",
      phone: "+49 30 123",
      requestType: "new_build",
      projectAddress: "Beispielstrasse 1",
      bgfM2: 150,
      rawInput: "Manual note",
      missingData: [],
      isStandard: true
    };

    await expect(
      createLeadRecordFromIntakeDraft(client, {
        workspaceId: "workspace-1",
        now: new Date("2026-05-21T00:00:00.000Z"),
        draft
      })
    ).resolves.toMatchObject({
      id: "lead-record-2",
      leadId: "L-2026-002"
    });
    expect(created).toEqual([
      {
        data: {
          workspaceId: "workspace-1",
          leadId: "L-2026-002",
          status: "new",
          rawInput: "Manual note",
          requestType: "new_build",
          projectAddress: "Beispielstrasse 1",
          bgfM2: 150,
          isStandard: true,
          missingData: [],
          temperature: "warm"
        }
      }
    ]);
  });
});
