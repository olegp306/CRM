import { afterEach, describe, expect, it, vi } from "vitest";
import { isGoogleAdminAuthConfigured, isSessionAllowed } from "./auth";

describe("web Google admin auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays disabled until Google credentials and admin emails are configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("CRM_ALLOWED_ADMIN_EMAILS", "");

    expect(isGoogleAdminAuthConfigured()).toBe(false);
    expect(isSessionAllowed(null)).toBe(true);
  });

  it("allows only configured Gmail admin sessions when enabled", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("CRM_ALLOWED_ADMIN_EMAILS", "ekaterina.reyzbikh@gmail.com,olegp306@gmail.com");

    expect(isGoogleAdminAuthConfigured()).toBe(true);
    expect(isSessionAllowed({ expires: "2026-06-01", user: { email: "olegp306@gmail.com" } })).toBe(true);
    expect(isSessionAllowed({ expires: "2026-06-01", user: { email: "other@gmail.com" } })).toBe(false);
  });
});
