import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "app-chrome.tsx"), "utf8");

describe("AppChrome", () => {
  it("renders the app version in mobile chrome as a visual deployment marker", () => {
    expect(source).toContain("Mobile version marker");
    expect(source).toContain("lg:hidden");
    expect(source).toContain("v{appVersion}");
  });

  it("opens a changelog dialog from the app version marker", () => {
    expect(source).toContain("isChangelogOpen");
    expect(source).toContain("Open changelog for version");
    expect(source).toContain("ChangelogDialog");
    expect(source).toContain("role=\"dialog\"");
  });
});
