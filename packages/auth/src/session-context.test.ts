import { describe, expect, it } from "vitest";
import { createDemoWorkspaceSession, resolveWorkspaceSession } from "./session-context";

describe("workspace session context", () => {
  it("creates a demo workspace session for the app shell", () => {
    expect(createDemoWorkspaceSession()).toEqual({
      workspaceId: "workspace-demo",
      workspaceName: "Studio OS",
      workspaceDescription: "Airbnb Calm workspace",
      userId: "user-demo",
      userName: "Demo Admin",
      role: "admin",
      primaryColor: "#1c1917"
    });
  });

  it("allows demo session overrides for route and provider previews", () => {
    expect(
      createDemoWorkspaceSession({
        role: "viewer",
        workspaceName: "Client Portal"
      })
    ).toMatchObject({
      role: "viewer",
      workspaceName: "Client Portal",
      userId: "user-demo"
    });
  });

  it("resolves workspace session from request-like values", () => {
    expect(
      resolveWorkspaceSession({
        workspaceId: "workspace-2",
        workspaceName: "Client Studio",
        workspaceDescription: "Client workspace",
        userId: "user-2",
        userName: "Ada Lovelace",
        role: "manager",
        primaryColor: "#0f766e"
      })
    ).toEqual({
      workspaceId: "workspace-2",
      workspaceName: "Client Studio",
      workspaceDescription: "Client workspace",
      userId: "user-2",
      userName: "Ada Lovelace",
      role: "manager",
      primaryColor: "#0f766e"
    });
  });

  it("falls back to the demo session when request values are incomplete", () => {
    expect(
      resolveWorkspaceSession({
        workspaceId: "workspace-2",
        role: "mystery"
      })
    ).toEqual(createDemoWorkspaceSession());
  });
});
