import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsPageSource = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const runtimePageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("telegram runtime settings UI", () => {
  it("links Telegram runtime from the Settings page", () => {
    expect(settingsPageSource).toContain("Telegram runtime");
    expect(settingsPageSource).toContain("/settings/telegram-runtime");
  });

  it("offers legacy and LangGraph runtime choices with a test-stand warning", () => {
    expect(runtimePageSource).toContain("value=\"legacy\"");
    expect(runtimePageSource).toContain("value=\"langgraph\"");
    expect(runtimePageSource).toContain("Current runtime:");
    expect(runtimePageSource).toContain("test Telegram bot and test database");
  });

  it("persists the selected runtime as Telegram runtime JSON", () => {
    expect(actionsSource).toContain("updateTelegramRuntimeSettingsAction");
    expect(actionsSource).toContain("allowedRuntimes");
    expect(actionsSource).toContain("createTelegramRuntimePrompt");
    expect(actionsSource).toContain("runtime === \"langgraph\" ? \"langgraph\" : \"legacy\"");
    expect(actionsSource).toContain("saveTelegramRuntimeSetting");
    expect(actionsSource).toContain("revalidatePath(\"/settings/telegram-runtime\")");
  });
});
