import { describe, expect, it } from "vitest";
import { clearWorkspaceLeadTable } from "./danger-zone-store";

function createClient() {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];
  return {
    calls,
    client: {
      lead: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "lead", method: "deleteMany", args });
          return { count: 3 };
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
            metadata: { deletedCount: 3 }
          }
        }
      }
    ]);
  });
});
