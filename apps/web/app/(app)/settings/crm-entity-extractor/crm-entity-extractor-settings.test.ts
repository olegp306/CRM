import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsPageSource = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const extractorPageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("crm entity extractor settings UI", () => {
  it("shows orchestrator as the top routing layer and specialized agents below", () => {
    expect(settingsPageSource).toContain("Agent routing");
    expect(settingsPageSource).toContain("CRM orchestrator");
    expect(settingsPageSource).toContain("Specialized agents");
    expect(settingsPageSource).toContain("/settings/crm-entity-extractor");
  });

  it("contains a prompt textarea and model selector for the extractor", () => {
    expect(extractorPageSource).toContain("CRM entity extractor");
    expect(extractorPageSource).toContain("Entity extraction model");
    expect(extractorPageSource).toContain("CRM entity extractor metaprompt");
    expect(extractorPageSource).toContain("textarea");
  });

  it("validates and saves extractor settings", () => {
    expect(actionsSource).toContain("updateCrmEntityExtractorSettingsAction");
    expect(actionsSource).toContain("saveCrmEntityExtractorSetting");
    expect(actionsSource).toContain("Unsupported CRM entity extractor model");
  });
});
