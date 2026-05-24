import { describe, expect, it } from "vitest";
import { currentAppMetadata } from "./app-metadata";

describe("app metadata", () => {
  it("exposes the current SemVer app version from package metadata", () => {
    expect(currentAppMetadata).toEqual({
      name: "crm-saas-v1",
      version: "0.1.2"
    });
  });
});
