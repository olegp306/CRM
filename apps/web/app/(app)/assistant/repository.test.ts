import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { selectAssistantRepositoryRuntime } from "./repository";

describe("selectAssistantRepositoryRuntime", () => {
  it("keeps the memory repository in tests when no database URL is configured", () => {
    expect(
      selectAssistantRepositoryRuntime({
        databaseUrl: undefined,
        nodeEnv: "test",
        memoryRepository: "memory",
        prismaRepository: "prisma"
      })
    ).toBe("memory");
  });

  it("requires a database URL outside tests", () => {
    expect(() =>
      selectAssistantRepositoryRuntime({
        databaseUrl: undefined,
        nodeEnv: "development",
        memoryRepository: "memory",
        prismaRepository: "prisma"
      })
    ).toThrow("DATABASE_URL is required for assistant repository in development.");
  });

  it("uses the Prisma repository when a database URL is configured", () => {
    expect(
      selectAssistantRepositoryRuntime({
        databaseUrl: "postgresql://example",
        nodeEnv: "development",
        memoryRepository: "memory",
        prismaRepository: "prisma"
      })
    ).toBe("prisma");
  });

  it("refreshes old global memory repositories without audit event writes", () => {
    const source = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

    expect(source).toContain('"saveAuditEvent" in globalForAssistant.assistantRepository');
  });
});
