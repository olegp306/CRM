import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const releaseActionsSource = readFileSync(join(__dirname, "release-notes-actions.tsx"), "utf8");
const exportRouteSource = readFileSync(join(__dirname, "export", "route.ts"), "utf8");

describe("platform feedback version filter wiring", () => {
  it("keeps appVersion in page filter links and export route parsing", () => {
    expect(pageSource).toContain("appVersion");
    expect(pageSource).toContain("Version");
    expect(pageSource).toContain("currentAppMetadata.version");
    expect(pageSource).toContain("Release triage");
    expect(pageSource).toContain("inbox.releaseTriage");
    expect(pageSource).toContain("Release notes draft");
    expect(pageSource).toContain("inbox.releaseNotesDrafts");
    expect(pageSource).toContain("Release workflow");
    expect(pageSource).toContain("inbox.releaseWorkflows");
    expect(pageSource).toContain("Download Markdown");
    expect(pageSource).toContain("ReleaseNotesActions");
    expect(pageSource).toContain("/platform/feedback/release-notes/export");
    expect(releaseActionsSource).toContain("Plan release items");
    expect(releaseActionsSource).toContain("planReleaseFeedbackAction");
    expect(releaseActionsSource).toContain("router.refresh");
    expect(exportRouteSource).toContain("appVersion: url.searchParams.get(\"appVersion\")");
  });
});
