import { describe, expect, it } from "vitest";
import { getPlatformRouteDecision, getWorkspaceRouteDecision } from "./route-guards";

describe("route guard decisions", () => {
  it("allows workspace members into workspace routes", () => {
    expect(getWorkspaceRouteDecision({ type: "member", workspaceId: "workspace-1", role: "owner" })).toEqual({
      type: "allow",
      workspaceId: "workspace-1"
    });
  });

  it("redirects pending invite users to accept invite", () => {
    expect(getWorkspaceRouteDecision({ type: "pending_invite", workspaceId: "workspace-1", role: "member" })).toEqual({
      type: "redirect",
      to: "/accept-invite"
    });
  });

  it("shows no access for users without workspace access", () => {
    expect(getWorkspaceRouteDecision({ type: "no_access" })).toEqual({ type: "no_access" });
  });

  it("allows only platform admins into platform routes", () => {
    expect(getPlatformRouteDecision("platform_admin")).toEqual({ type: "allow" });
    expect(getPlatformRouteDecision(null)).toEqual({ type: "forbidden" });
  });
});
