import { describe, expect, it } from "vitest";
import { getPermissionBlockedResponse } from "./permission-blocked";

describe("getPermissionBlockedResponse", () => {
  it("returns a user-safe blocked response and signal metadata", () => {
    expect(
      getPermissionBlockedResponse({
        role: "viewer",
        actionType: "create_lead",
        moduleContext: "leads"
      })
    ).toEqual({
      message: "You do not have permission to perform create_lead. I captured this as a product signal.",
      feedbackType: "permission_blocked",
      moduleContext: "leads",
      role: "viewer"
    });
  });
});
