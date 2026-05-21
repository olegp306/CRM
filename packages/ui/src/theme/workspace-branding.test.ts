import { describe, expect, it } from "vitest";
import { createWorkspaceThemeStyle } from "./workspace-branding";

describe("createWorkspaceThemeStyle", () => {
  it("uses workspace primary color when it is a valid hex color", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "#2563eb" })).toEqual({
      "--primary": "37 99 235"
    });
  });

  it("ignores invalid workspace colors", () => {
    expect(createWorkspaceThemeStyle({ primaryColor: "blue" })).toEqual({});
  });
});
