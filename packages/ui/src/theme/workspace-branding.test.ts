import { describe, expect, it } from "vitest";
import { createWorkspaceThemeStyle } from "./workspace-branding";

describe("createWorkspaceThemeStyle", () => {
  it("uses workspace primary color when it is a valid hex color", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb" })).toEqual({
      "--primary": "37 99 235"
    });
  });

  it("adds nocturne theme color tokens", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb", themePreference: "nocturne" })).toMatchObject({
      "--background": "18 20 19",
      "--surface": "29 32 31",
      "--foreground": "236 241 238",
      "--primary": "37 99 235"
    });
  });

  it("adds graphite theme color tokens", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb", themePreference: "graphite" })).toMatchObject({
      "--background": "12 14 17",
      "--surface": "24 27 31",
      "--foreground": "238 242 246",
      "--primary": "37 99 235"
    });
  });

  it("adds warm theme color tokens", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#92400e", themePreference: "warm" })).toMatchObject({
      "--background": "246 248 243",
      "--surface": "255 255 252",
      "--foreground": "31 37 32",
      "--primary": "146 64 14"
    });
  });

  it("ignores invalid workspace colors", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "blue" })).toEqual({});
  });
});
