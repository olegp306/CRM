import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDatabaseEnv } from "./load-database-env";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(() => {
  if (ORIGINAL_DATABASE_URL) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  } else {
    delete process.env.DATABASE_URL;
  }
});

describe("loadDatabaseEnv", () => {
  it("loads DATABASE_URL from a local env file when the process env is empty", () => {
    delete process.env.DATABASE_URL;
    const directory = mkdtempSync(join(tmpdir(), "ai-crm-env-"));
    const envPath = join(directory, ".env");
    writeFileSync(envPath, 'DATABASE_URL="postgresql://local-db"\n', "utf8");

    loadDatabaseEnv(envPath);

    expect(process.env.DATABASE_URL).toBe("postgresql://local-db");
  });

  it("does not override an existing DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://existing";
    const directory = mkdtempSync(join(tmpdir(), "ai-crm-env-"));
    const envPath = join(directory, ".env");
    writeFileSync(envPath, 'DATABASE_URL="postgresql://from-file"\n', "utf8");

    loadDatabaseEnv(envPath);

    expect(process.env.DATABASE_URL).toBe("postgresql://existing");
  });
});
