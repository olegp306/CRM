import { describe, expect, it } from "vitest";
import { assertDeploymentDatabaseIsolation, resolveDeploymentEnvironment } from "./deployment-isolation";

describe("deployment isolation", () => {
  it("falls back to public deployment env when the private env is empty", () => {
    expect(resolveDeploymentEnvironment({ CRM_DEPLOYMENT_ENV: "", NEXT_PUBLIC_CRM_DEPLOYMENT_ENV: "test" })).toBe("test");
  });

  it("allows test deployment only with an explicit test database", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_DEPLOYMENT_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).not.toThrow();
  });

  it("blocks test deployment from using a non-test database", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_DEPLOYMENT_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15431/ai_crm?schema=public"
      })
    ).toThrow("Refusing to start TEST deployment with non-test database");
  });

  it("blocks production deployment from using a test database", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_DEPLOYMENT_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).toThrow("Refusing to start PRODUCTION deployment with test database");
  });

  it("requires an explicit test or production choice for guarded deployments", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_REQUIRE_DEPLOYMENT_CONFIRMATION: "true",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).toThrow("CRM_DEPLOYMENT_ENV must be set to test or production");
  });

  it("requires deployment confirmation to match the selected environment", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_REQUIRE_DEPLOYMENT_CONFIRMATION: "true",
        CRM_DEPLOYMENT_ENV: "test",
        CRM_DEPLOYMENT_CONFIRMATION: "production",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).toThrow("CRM_DEPLOYMENT_CONFIRMATION must match CRM_DEPLOYMENT_ENV");
  });

  it("requires telegram bot environment to match guarded deployments", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_REQUIRE_DEPLOYMENT_CONFIRMATION: "true",
        CRM_DEPLOYMENT_ENV: "test",
        CRM_DEPLOYMENT_CONFIRMATION: "test",
        TELEGRAM_BOT_TOKEN: "telegram-token",
        TELEGRAM_BOT_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).toThrow("TELEGRAM_BOT_ENV must match CRM_DEPLOYMENT_ENV");
  });

  it("allows guarded test deployment only when env, confirmation, database, and bot marker agree", () => {
    expect(() =>
      assertDeploymentDatabaseIsolation({
        CRM_REQUIRE_DEPLOYMENT_CONFIRMATION: "true",
        CRM_DEPLOYMENT_ENV: "test",
        CRM_DEPLOYMENT_CONFIRMATION: "test",
        TELEGRAM_BOT_TOKEN: "telegram-token",
        TELEGRAM_BOT_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:15432/ai_crm_test?schema=public"
      })
    ).not.toThrow();
  });
});
