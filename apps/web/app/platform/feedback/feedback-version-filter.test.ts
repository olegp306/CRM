import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const exportRouteSource = readFileSync(join(__dirname, "export", "route.ts"), "utf8");

describe("platform feedback version filter wiring", () => {
  it("keeps appVersion in page filter links and export route parsing", () => {
    expect(pageSource).toContain("appVersion");
    expect(pageSource).toContain("Version");
    expect(pageSource).toContain("currentAppMetadata.version");
    expect(pageSource).toContain("Release triage");
    expect(pageSource).toContain("inbox.releaseTriage");
    expect(exportRouteSource).toContain("appVersion: url.searchParams.get(\"appVersion\")");
  });
});
