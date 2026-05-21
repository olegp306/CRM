import { describe, expect, it } from "vitest";
import { findUnknownPlaceholders, parsePlaceholders } from "./placeholders";

describe("template placeholders", () => {
  it("parses unique placeholders", () => {
    expect(parsePlaceholders("Hello {{client_name}}, project {{ project_address }} {{client_name}}")).toEqual([
      "client_name",
      "project_address"
    ]);
  });

  it("finds unknown placeholders", () => {
    expect(findUnknownPlaceholders(["client_name", "wrong"], ["client_name"])).toEqual(["wrong"]);
  });
});
