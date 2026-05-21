import { describe, expect, it } from "vitest";
import { createAssistantLeadPrismaStore, type AssistantLeadPrismaClientLike } from "./assistant-lead-prisma-store";

type Call = {
  method: string;
  args: unknown;
};

function createFakeClient() {
  const calls: Call[] = [];
  const rows = [
    {
      id: "lead-record-1",
      workspaceId: "workspace-1",
      leadId: "L-2026-001",
      status: "new",
      rawInput: "Existing lead"
    }
  ];
  const client: AssistantLeadPrismaClientLike = {
    lead: {
      findMany: (args) => {
        calls.push({ method: "findMany", args });
        return Promise.resolve(rows);
      },
      create: (args) => {
        calls.push({ method: "create", args });
        return Promise.resolve({
          id: "lead-record-2",
          workspaceId: "workspace-1",
          leadId: "L-2026-002",
          status: "new",
          rawInput: "Create lead Anna Beispiel"
        });
      },
      update: (args) => {
        calls.push({ method: "update", args });
        return Promise.resolve({
          id: "lead-record-1",
          workspaceId: "workspace-1",
          leadId: "L-2026-001",
          status: "kp_sent",
          rawInput: "Existing lead"
        });
      }
    }
  };

  return { client, calls };
}

describe("assistant lead Prisma store", () => {
  it("lists assistant-created leads for a workspace", async () => {
    const { client, calls } = createFakeClient();
    const store = createAssistantLeadPrismaStore(client);

    const leads = await store.list("workspace-1");

    expect(leads).toEqual([
      {
        id: "lead-record-1",
        workspaceId: "workspace-1",
        leadId: "L-2026-001",
        status: "new",
        rawInput: "Existing lead"
      }
    ]);
    expect(calls[0]).toEqual({
      method: "findMany",
      args: {
        where: { workspaceId: "workspace-1" },
        orderBy: { createdDate: "desc" }
      }
    });
  });

  it("creates durable leads from assistant execution input", async () => {
    const { client, calls } = createFakeClient();
    const store = createAssistantLeadPrismaStore(client);

    const lead = await store.create({
      workspaceId: "workspace-1",
      leadId: "L-2026-002",
      status: "new",
      rawInput: "Create lead Anna Beispiel"
    });

    expect(lead).toEqual({
      id: "lead-record-2",
      workspaceId: "workspace-1",
      leadId: "L-2026-002",
      status: "new",
      rawInput: "Create lead Anna Beispiel"
    });
    expect(calls[0]).toEqual({
      method: "create",
      args: {
        data: {
          workspaceId: "workspace-1",
          leadId: "L-2026-002",
          status: "new",
          rawInput: "Create lead Anna Beispiel"
        }
      }
    });
  });

  it("marks KP as sent through a workspace-scoped lead update", async () => {
    const { client, calls } = createFakeClient();
    const store = createAssistantLeadPrismaStore(client);

    const lead = await store.markKpSent({
      workspaceId: "workspace-1",
      leadId: "L-2026-001",
      status: "kp_sent",
      kpSentDate: new Date("2026-05-21T10:30:00.000Z"),
      followup1Date: new Date("2026-05-28T10:30:00.000Z"),
      followupStatus: "planned",
      requestedByUserId: "user-1"
    });

    expect(lead).toEqual({
      id: "lead-record-1",
      workspaceId: "workspace-1",
      leadId: "L-2026-001",
      status: "kp_sent",
      kpSentDate: new Date("2026-05-21T10:30:00.000Z"),
      followup1Date: new Date("2026-05-28T10:30:00.000Z"),
      followupStatus: "planned",
      requestedByUserId: "user-1"
    });
    expect(calls[0]).toEqual({
      method: "update",
      args: {
        where: {
          workspaceId_leadId: {
            workspaceId: "workspace-1",
            leadId: "L-2026-001"
          }
        },
        data: {
          status: "kp_sent",
          kpSentDate: new Date("2026-05-21T10:30:00.000Z"),
          followup1Date: new Date("2026-05-28T10:30:00.000Z"),
          followupStatus: "planned"
        }
      }
    });
  });
});
