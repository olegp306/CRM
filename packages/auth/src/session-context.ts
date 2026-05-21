import type { WorkspaceRole } from "./permissions";

const workspaceRoles = new Set<WorkspaceRole>(["owner", "admin", "manager", "member", "viewer"]);

export type WorkspaceSessionContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string;
  userId: string;
  userName: string;
  role: WorkspaceRole;
  primaryColor: string;
};

export type WorkspaceSessionSource = Partial<Record<keyof WorkspaceSessionContext, string>>;

export function createDemoWorkspaceSession(
  overrides: Partial<WorkspaceSessionContext> = {}
): WorkspaceSessionContext {
  return {
    workspaceId: "workspace-demo",
    workspaceName: "Studio OS",
    workspaceDescription: "Airbnb Calm workspace",
    userId: "user-demo",
    userName: "Demo Admin",
    role: "admin",
    primaryColor: "#1c1917",
    ...overrides
  };
}

export function resolveWorkspaceSession(source: WorkspaceSessionSource): WorkspaceSessionContext {
  if (
    !source.workspaceId ||
    !source.workspaceName ||
    !source.workspaceDescription ||
    !source.userId ||
    !source.userName ||
    !source.primaryColor ||
    !source.role ||
    !workspaceRoles.has(source.role as WorkspaceRole)
  ) {
    return createDemoWorkspaceSession();
  }

  return {
    workspaceId: source.workspaceId,
    workspaceName: source.workspaceName,
    workspaceDescription: source.workspaceDescription,
    userId: source.userId,
    userName: source.userName,
    role: source.role as WorkspaceRole,
    primaryColor: source.primaryColor
  };
}
