import { describe, expect, it } from "vitest";
import { canManageTemplates, canUseAssistantActionMode, canViewPlatformRoute } from "./permissions";

describe("permissions", () => {
  it("allows owner and admin to use assistant action mode", () => {
    expect(canUseAssistantActionMode("owner")).toBe(true);
    expect(canUseAssistantActionMode("admin")).toBe(true);
    expect(canUseAssistantActionMode("manager")).toBe(false);
    expect(canUseAssistantActionMode("member")).toBe(false);
    expect(canUseAssistantActionMode("viewer")).toBe(false);
  });

  it("allows owner and admin to manage templates", () => {
    expect(canManageTemplates("owner")).toBe(true);
    expect(canManageTemplates("admin")).toBe(true);
    expect(canManageTemplates("manager")).toBe(false);
  });

  it("allows only platform admin to view platform routes", () => {
    expect(canViewPlatformRoute("platform_admin")).toBe(true);
    expect(canViewPlatformRoute(null)).toBe(false);
  });
});
