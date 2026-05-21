import { canViewPlatformRoute, type PlatformRole } from "./permissions";
import type { WorkspaceAccess } from "./workspace-access";

export type WorkspaceRouteDecision =
  | {
      type: "allow";
      workspaceId: string;
    }
  | {
      type: "redirect";
      to: "/accept-invite";
    }
  | {
      type: "no_access";
    };

export type PlatformRouteDecision =
  | {
      type: "allow";
    }
  | {
      type: "forbidden";
    };

export function getWorkspaceRouteDecision(access: WorkspaceAccess): WorkspaceRouteDecision {
  if (access.type === "member") {
    return {
      type: "allow",
      workspaceId: access.workspaceId
    };
  }

  if (access.type === "pending_invite") {
    return {
      type: "redirect",
      to: "/accept-invite"
    };
  }

  return { type: "no_access" };
}

export function getPlatformRouteDecision(role: PlatformRole | null): PlatformRouteDecision {
  return canViewPlatformRoute(role) ? { type: "allow" } : { type: "forbidden" };
}
