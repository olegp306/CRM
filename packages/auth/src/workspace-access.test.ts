import { describe, expect, it } from "vitest";
import { resolveWorkspaceAccess } from "./workspace-access";

describe("resolveWorkspaceAccess", () => {
  it("grants active membership over pending invite", () => {
    expect(
      resolveWorkspaceAccess({
        membership: { workspaceId: "workspace-1", role: "manager" },
        pendingInvite: { workspaceId: "workspace-2", role: "viewer" }
      })
    ).toEqual({ type: "member", workspaceId: "workspace-1", role: "manager" });
  });

  it("returns pending invite when membership does not exist", () => {
    expect(
      resolveWorkspaceAccess({
        membership: null,
        pendingInvite: { workspaceId: "workspace-2", role: "viewer" }
      })
    ).toEqual({ type: "pending_invite", workspaceId: "workspace-2", role: "viewer" });
  });

  it("blocks users without membership or invite", () => {
    expect(resolveWorkspaceAccess({ membership: null, pendingInvite: null })).toEqual({ type: "no_access" });
  });
});
