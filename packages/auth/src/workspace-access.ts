import type { WorkspaceRole } from "./permissions";

export type WorkspaceAccessInput = {
  membership: WorkspaceAccessRecord | null;
  pendingInvite: WorkspaceAccessRecord | null;
};

export type WorkspaceAccessRecord = {
  workspaceId: string;
  role: WorkspaceRole;
};

export type WorkspaceAccess =
  | {
      type: "member";
      workspaceId: string;
      role: WorkspaceRole;
    }
  | {
      type: "pending_invite";
      workspaceId: string;
      role: WorkspaceRole;
    }
  | {
      type: "no_access";
    };

export function resolveWorkspaceAccess({ membership, pendingInvite }: WorkspaceAccessInput): WorkspaceAccess {
  if (membership) {
    return {
      type: "member",
      workspaceId: membership.workspaceId,
      role: membership.role
    };
  }

  if (pendingInvite) {
    return {
      type: "pending_invite",
      workspaceId: pendingInvite.workspaceId,
      role: pendingInvite.role
    };
  }

  return { type: "no_access" };
}
