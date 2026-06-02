import { describe, expect, it } from "vitest";
import { clearWorkspaceLeadTable } from "./danger-zone-store";

function createClient() {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];
  return {
    calls,
    client: {
      lead: {
        findMany: async (args: unknown) => {
          calls.push({ model: "lead", method: "findMany", args });
          return [{ id: "lead-record-1" }, { id: "lead-record-2" }, { id: "lead-record-3" }];
        },
        deleteMany: async (args: unknown) => {
          calls.push({ model: "lead", method: "deleteMany", args });
          return { count: 3 };
        }
      },
      leadContextEntity: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "leadContextEntity", method: "deleteMany", args });
          return { count: 5 };
        }
      },
      crmCalendarAction: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "crmCalendarAction", method: "deleteMany", args });
          return { count: 2 };
        }
      },
      auditLog: {
        create: async (args: unknown) => {
          calls.push({ model: "auditLog", method: "create", args });
          return args;
        }
      }
    }
  };
}

describe("settings danger zone store", () => {
  it("rejects lead table deletion when the confirmation password is wrong", async () => {
    const { client, calls } = createClient();

    await expect(
      clearWorkspaceLeadTable(client, {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        password: "wrong"
      })
    ).rejects.toThrow("Invalid confirmation password.");

    expect(calls).toEqual([]);
  });

  it("deletes only lead rows for the current workspace and writes an audit event", async () => {
    const { client, calls } = createClient();

    await expect(
      clearWorkspaceLeadTable(client, {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        password: "191181"
      })
    ).resolves.toEqual({ deletedCount: 3 });

    expect(calls).toEqual([
      {
        model: "lead",
        method: "findMany",
        args: { where: { workspaceId: "workspace-1" }, select: { id: true } }
      },
      {
        model: "leadContextEntity",
        method: "deleteMany",
        args: { where: { workspaceId: "workspace-1", leadRecordId: { in: ["lead-record-1", "lead-record-2", "lead-record-3"] } } }
      },
      {
        model: "crmCalendarAction",
        method: "deleteMany",
        args: { where: { workspaceId: "workspace-1", leadRecordId: { in: ["lead-record-1", "lead-record-2", "lead-record-3"] } } }
      },
      {
        model: "lead",
        method: "deleteMany",
        args: { where: { workspaceId: "workspace-1" } }
      },
      {
        model: "auditLog",
        method: "create",
        args: {
          data: {
            workspaceId: "workspace-1",
            actorUserId: "user-1",
            action: "settings.leads.clear_table",
            targetType: "Lead",
            targetId: null,
            metadata: { deletedCount: 3, deletedContextEntityCount: 5, deletedCalendarActionCount: 2 }
          }
        }
      }
    ]);
  });
});
