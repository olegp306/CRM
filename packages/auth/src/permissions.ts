export type WorkspaceRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type PlatformRole = "platform_admin";

export function canUseAssistantActionMode(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageTemplates(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteUsers(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function canViewPlatformRoute(role: PlatformRole | null): boolean {
  return role === "platform_admin";
}
