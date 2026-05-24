import { describe, expect, it } from "vitest";
import { createAdminEmailAllowlist, isAdminEmailAllowed } from "./admin-email-allowlist";

describe("admin email allowlist", () => {
  it("normalizes comma-separated Gmail admins", () => {
    expect(createAdminEmailAllowlist(" ekaterina.reyzbikh@gmail.com, OLEGP306@gmail.com ")).toEqual(
      new Set(["ekaterina.reyzbikh@gmail.com", "olegp306@gmail.com"])
    );
  });

  it("allows only normalized emails from the allowlist", () => {
    const allowlist = createAdminEmailAllowlist("ekaterina.reyzbikh@gmail.com,olegp306@gmail.com");

    expect(isAdminEmailAllowed("OlegP306@gmail.com", allowlist)).toBe(true);
    expect(isAdminEmailAllowed("someone@example.com", allowlist)).toBe(false);
    expect(isAdminEmailAllowed(null, allowlist)).toBe(false);
  });
});
