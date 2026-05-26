import type { WorkspaceRole } from "./permissions";

const workspaceRoles = new Set<WorkspaceRole>(["owner", "admin", "manager", "member", "viewer"]);
const themePreferences = new Set<WorkspaceThemePreference>(["light", "dark", "warm"]);

export type WorkspaceThemePreference = "light" | "dark" | "warm";

export type WorkspaceSessionContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string;
  userId: string;
  userName: string;
  role: WorkspaceRole;
  primaryColor: string;
  themePreference: WorkspaceThemePreference;
};

export type WorkspaceSessionSource = Partial<Record<keyof WorkspaceSessionContext, string>>;

export function createDemoWorkspaceSession(
  overrides: Partial<WorkspaceSessionContext> = {}
): WorkspaceSessionContext {
  return {
    workspaceId: "workspace-demo",
    workspaceName: "Workspace CRM",
    workspaceDescription: "Architecture CRM workspace",
    userId: "user-demo",
    userName: "Demo Admin",
    role: "admin",
    primaryColor: "#1c1917",
    themePreference: "light",
    ...overrides
  };
}

export function resolveWorkspaceSession(source: WorkspaceSessionSource): WorkspaceSessionContext {
  if (source.role !== undefined && !workspaceRoles.has(source.role as WorkspaceRole)) {
    return createDemoWorkspaceSession();
  }

  if (source.themePreference !== undefined && !themePreferences.has(source.themePreference as WorkspaceThemePreference)) {
    return createDemoWorkspaceSession();
  }

  const defaults = createDemoWorkspaceSession();

  return {
    workspaceId: source.workspaceId ?? defaults.workspaceId,
    workspaceName: source.workspaceName ?? defaults.workspaceName,
    workspaceDescription: source.workspaceDescription ?? defaults.workspaceDescription,
    userId: source.userId ?? defaults.userId,
    userName: source.userName ?? defaults.userName,
    role: (source.role as WorkspaceRole | undefined) ?? defaults.role,
    primaryColor: source.primaryColor ?? defaults.primaryColor,
    themePreference: (source.themePreference as WorkspaceThemePreference | undefined) ?? "light"
  };
}
