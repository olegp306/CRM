import { describe, expect, it } from "vitest";
import { createWorkspaceThemeStyle } from "./workspace-branding";

describe("createWorkspaceThemeStyle", () => {
  it("uses workspace primary color when it is a valid hex color", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb" })).toEqual({
      "--primary": "37 99 235"
    });
  });

  it("adds dark theme color tokens", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb", themePreference: "dark" })).toMatchObject({
      "--background": "18 18 18",
      "--surface": "31 31 31",
      "--foreground": "245 245 244",
      "--primary": "37 99 235"
    });
  });

  it("adds warm theme color tokens", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#92400e", themePreference: "warm" })).toMatchObject({
      "--background": "252 247 240",
      "--surface": "255 251 245",
      "--foreground": "41 33 27",
      "--primary": "146 64 14"
    });
  });

  it("ignores invalid workspace colors", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "blue" })).toEqual({});
  });
});
