import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRootEnv } from "./load-root-env";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalStorageProvider = process.env.STORAGE_PROVIDER;

afterEach(() => {
  restoreEnv("OPENAI_API_KEY", originalOpenAiKey);
  restoreEnv("STORAGE_PROVIDER", originalStorageProvider);
});

describe("loadRootEnv", () => {
  it("loads root env values without overriding values already provided to the web app", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-crm-env-"));
    const envPath = join(directory, ".env");
    process.env.OPENAI_API_KEY = "from-process";
    delete process.env.STORAGE_PROVIDER;

    try {
      await writeFile(envPath, 'OPENAI_API_KEY="from-root"\nSTORAGE_PROVIDER="s3"\n', "utf8");

      loadRootEnv(envPath);

      expect(process.env.OPENAI_API_KEY).toBe("from-process");
      expect(process.env.STORAGE_PROVIDER).toBe("s3");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
