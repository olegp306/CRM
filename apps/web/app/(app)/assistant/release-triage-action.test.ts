import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("platform feedback release triage action", () => {
  it("returns release triage data from the platform inbox action", () => {
    expect(actionsSource).toContain("createPlatformReleaseTriage");
    expect(actionsSource).toContain("createPlatformReleaseNotesDraft");
    expect(actionsSource).toContain("releaseTriage:");
    expect(actionsSource).toContain("releaseNotesDrafts:");
  });
});
