import { describe, expect, it } from "vitest";
import { createInviteToken, getInviteStatus } from "./invites";

describe("invite helpers", () => {
  it("creates URL-safe invite tokens", () => {
    const token = createInviteToken(() => new Uint8Array([1, 2, 3, 250, 251, 252]));

    expect(token).toBe("AQID-vv8");
  });

  it("classifies pending, accepted, and expired invites", () => {
    const now = new Date("2026-05-21T10:00:00.000Z");

    expect(getInviteStatus({ acceptedAt: null, expiresAt: new Date("2026-05-22T10:00:00.000Z") }, now)).toBe("pending");
    expect(getInviteStatus({ acceptedAt: new Date("2026-05-21T09:00:00.000Z"), expiresAt: new Date("2026-05-22T10:00:00.000Z") }, now)).toBe("accepted");
    expect(getInviteStatus({ acceptedAt: null, expiresAt: new Date("2026-05-20T10:00:00.000Z") }, now)).toBe("expired");
  });
});
