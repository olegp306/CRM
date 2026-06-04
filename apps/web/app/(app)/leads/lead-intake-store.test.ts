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

  it("links a new lead to an existing matching client", async () => {
    const createdLeads: unknown[] = [];
    const createdClients: unknown[] = [];
    const client: LeadIntakePrismaClientLike = {
      client: {
        findMany: async () => [
          { id: "client-record-1", clientId: "C-2026-001", name: "Anna Beispiel", email: "anna@example.com", phone: "+49 30 123" }
        ],
        create: async (args) => {
          createdClients.push(args);
          return { id: "unused", clientId: "unused" };
        }
      },
      lead: {
        findMany: async () => [],
        create: async (args) => {
          createdLeads.push(args);
          return {
            id: "lead-record-1",
            leadId: "L-2026-001",
            status: "new",
            rawInput: "Manual note",
            requestType: "new_build",
            projectAddress: "Beispielstrasse 1"
          };
        }
      }
    };

    await createLeadRecordFromIntakeDraft(client, {
      workspaceId: "workspace-1",
      now: new Date("2026-05-21T00:00:00.000Z"),
      draft: {
        source: "web",
        clientName: "Anna Beispiel",
        email: "ANNA@example.com",
        phone: "+49 30 123",
        requestType: "new_build",
        projectAddress: "Beispielstrasse 1",
        bgfM2: 150,
        rawInput: "Manual note",
        missingData: [],
        isStandard: true
      }
    });

    expect(createdClients).toEqual([]);
    expect(createdLeads).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          clientRecordId: "client-record-1"
        })
      })
    ]);
  });

  it("creates and links a client when a lead has enough contact data", async () => {
    const createdLeads: unknown[] = [];
    const createdClients: unknown[] = [];
    const client: LeadIntakePrismaClientLike = {
      client: {
        findMany: async () => [{ id: "client-record-1", clientId: "C-2026-001", name: "Other Client", email: "other@example.com", phone: null }],
        create: async (args) => {
          createdClients.push(args);
          return { id: "client-record-2", clientId: "C-2026-002" };
        }
      },
      lead: {
        findMany: async () => [],
        create: async (args) => {
          createdLeads.push(args);
          return {
            id: "lead-record-1",
            leadId: "L-2026-001",
            status: "new",
            rawInput: "Manual note",
            requestType: "new_build",
            projectAddress: "Beispielstrasse 1"
          };
        }
      }
    };

    await createLeadRecordFromIntakeDraft(client, {
      workspaceId: "workspace-1",
      now: new Date("2026-05-21T00:00:00.000Z"),
      draft: {
        source: "telegram",
        clientName: "Irina Schneider",
        email: null,
        phone: "+49 160 4442211",
        requestType: "new_build",
        projectAddress: "Gartenweg 9",
        bgfM2: 195,
        rawInput: "Telegram note",
        missingData: [],
        isStandard: true
      }
    });

    expect(createdClients).toEqual([
      {
        data: {
          workspaceId: "workspace-1",
          clientId: "C-2026-002",
          name: "Irina Schneider",
          clientType: "private",
          email: null,
          phone: "+49 160 4442211",
          source: "telegram"
        }
      }
    ]);
    expect(createdLeads).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          clientRecordId: "client-record-2"
        })
      })
    ]);
  });
});
