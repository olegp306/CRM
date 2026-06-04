import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("branding settings page", () => {
  it("shows selected theme immediately from the checked radio state", () => {
    expect(pageSource).toContain('name="themePreference"');
    expect(pageSource).toContain("defaultChecked={session.themePreference === theme.id}");
    expect(pageSource).toContain("has-[:checked]:bg-surface");
    expect(pageSource).toContain("has-[:checked]:text-foreground");
  });

  it("uses theme-aware surfaces in the branding form", () => {
    expect(pageSource).toContain("bg-surface");
    expect(pageSource).not.toContain("bg-white");
  });
});
