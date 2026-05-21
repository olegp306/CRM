import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadRootEnv } from "./root-env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadRootEnv", () => {
  it("loads repository root env values without overriding existing process values", () => {
    const dir = mkdtempSync(join(tmpdir(), "crm-integrations-env-"));
    const envPath = join(dir, ".env");
    writeFileSync(envPath, 'TELEGRAM_BOT_TOKEN="telegram-secret"\nOPENAI_MODEL="gpt-test"\n');
    process.env.OPENAI_MODEL = "provided";
    delete process.env.TELEGRAM_BOT_TOKEN;

    loadRootEnv(envPath);

    expect(process.env.TELEGRAM_BOT_TOKEN).toBe("telegram-secret");
    expect(process.env.OPENAI_MODEL).toBe("provided");
    rmSync(dir, { recursive: true, force: true });
  });

  it("does nothing when the env file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "crm-integrations-env-"));
    const missingPath = join(dir, "nested", ".env");
    mkdirSync(join(dir, "nested"));

    expect(() => loadRootEnv(missingPath)).not.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });
});
