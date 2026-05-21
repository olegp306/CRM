import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const releaseActionsSource = readFileSync(join(__dirname, "release-notes-actions.tsx"), "utf8");
const exportRouteSource = readFileSync(join(__dirname, "export", "route.ts"), "utf8");
const historyExportRouteSource = readFileSync(join(__dirname, "release-history", "export", "route.ts"), "utf8");

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
    expect(pageSource).toContain("Release readiness");
    expect(pageSource).toContain("inbox.releaseReadiness");
    expect(pageSource).toContain("Release history");
    expect(pageSource).toContain("inbox.releaseHistory");
    expect(pageSource).toContain("/platform/feedback/release-history/export");
    expect(pageSource).toContain("Download Markdown");
    expect(pageSource).toContain("ReleaseNotesActions");
    expect(pageSource).toContain("/platform/feedback/release-notes/export");
    expect(releaseActionsSource).toContain("Plan release items");
    expect(releaseActionsSource).toContain("planReleaseFeedbackAction");
    expect(releaseActionsSource).toContain("actorUserId");
    expect(releaseActionsSource).toContain("router.refresh");
    expect(exportRouteSource).toContain("appVersion: url.searchParams.get(\"appVersion\")");
    expect(historyExportRouteSource).toContain("exportPlatformReleaseHistoryCsvAction");
    expect(historyExportRouteSource).toContain("text/csv; charset=utf-8");
  });
});
