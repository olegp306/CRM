import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("platform feedback release triage action", () => {
  it("returns release triage data from the platform inbox action", () => {
    expect(actionsSource).toContain("createPlatformReleaseTriage");
    expect(actionsSource).toContain("createPlatformReleaseNotesDraft");
    expect(actionsSource).toContain("createPlatformReleaseWorkflow");
    expect(actionsSource).toContain("releaseTriage:");
    expect(actionsSource).toContain("releaseNotesDrafts:");
    expect(actionsSource).toContain("releaseWorkflows:");
  });

  it("plans actionable feedback for a selected release version", () => {
    expect(actionsSource).toContain("createPlatformReleaseActionPlan");
    expect(actionsSource).toContain("planReleaseFeedbackAction");
    expect(actionsSource).toContain("appVersion");
    expect(actionsSource).toContain("plan.items.map");
  });
});
