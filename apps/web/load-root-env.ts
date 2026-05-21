import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadRootEnv(envPath = resolve(__dirname, "..", "..", ".env")): void {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
