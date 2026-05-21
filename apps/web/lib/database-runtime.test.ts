import { describe, expect, it } from "vitest";
import { assertDatabaseRuntime, selectDatabaseBackedRuntime } from "./database-runtime";

describe("database runtime policy", () => {
  it("keeps memory fallback available for tests", () => {
    expect(
      selectDatabaseBackedRuntime({
        databaseUrl: "",
        nodeEnv: "test",
        memoryRuntime: "memory",
        databaseRuntime: "database"
      })
    ).toBe("memory");
  });

  it("requires DATABASE_URL in development", () => {
    expect(() =>
      assertDatabaseRuntime({
        databaseUrl: "",
        nodeEnv: "development",
        runtimeName: "assistant repository"
      })
    ).toThrow("DATABASE_URL is required for assistant repository in development.");
  });

  it("requires DATABASE_URL in production", () => {
    expect(() =>
      selectDatabaseBackedRuntime({
        databaseUrl: "",
        nodeEnv: "production",
        memoryRuntime: "memory",
        databaseRuntime: "database",
        runtimeName: "assistant repository"
      })
    ).toThrow("DATABASE_URL is required for assistant repository in production.");
  });

  it("selects the database runtime when DATABASE_URL is set", () => {
    expect(
      selectDatabaseBackedRuntime({
        databaseUrl: "postgresql://user:pass@localhost:5432/ai_crm",
        nodeEnv: "development",
        memoryRuntime: "memory",
        databaseRuntime: "database"
      })
    ).toBe("database");
  });
});
