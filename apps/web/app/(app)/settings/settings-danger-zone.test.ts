import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const settingsPageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const dangerZoneSource = readFileSync(join(__dirname, "danger-zone.tsx"), "utf8");
const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("settings danger zone", () => {
  it("shows a protected lead table reset control in Settings", () => {
    expect(settingsPageSource).toContain("SettingsDangerZone");
    expect(dangerZoneSource).toContain("Clear leads table");
    expect(dangerZoneSource).toContain("type=\"password\"");
    expect(dangerZoneSource).toContain("Delete lead data");
    expect(dangerZoneSource).toContain("This deletes lead rows only");
  });

  it("routes the reset form through a server action that revalidates leads and settings", () => {
    expect(actionsSource).toContain("clearLeadTableAction");
    expect(actionsSource).toContain("clearWorkspaceLeadTable");
    expect(actionsSource).toContain("revalidatePath(\"/leads\")");
    expect(actionsSource).toContain("revalidatePath(\"/settings\")");
  });
});
