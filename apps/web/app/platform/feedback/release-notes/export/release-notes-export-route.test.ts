import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(join(__dirname, "route.ts"), "utf8");

describe("release notes export route", () => {
  it("exports selected app version release notes as Markdown", () => {
    expect(routeSource).toContain("createPlatformReleaseNotesMarkdown");
    expect(routeSource).toContain("createPlatformReleaseNotesDraft");
    expect(routeSource).toContain("appVersion");
    expect(routeSource).toContain("text/markdown; charset=utf-8");
  });
});
