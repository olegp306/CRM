import { describe, expect, it } from "vitest";
import { detectLeadMissingData } from "./missing-data";

describe("detectLeadMissingData", () => {
  it("returns no missing fields for a complete standard lead", () => {
    expect(
      detectLeadMissingData({
        clientName: "Anna Beispiel",
        requestType: "new_build",
        projectAddress: "Beispielstrasse 1",
        bgfM2: 150
      })
    ).toEqual([]);
  });

  it("requires BGF for standard new build pricing", () => {
    expect(
      detectLeadMissingData({
        clientName: "Anna Beispiel",
        requestType: "new_build",
        projectAddress: "Beispielstrasse 1"
      })
    ).toEqual(["bgfM2"]);
  });

  it("reports core missing fields in stable order", () => {
    expect(detectLeadMissingData({})).toEqual(["clientName", "requestType", "projectAddress"]);
  });
});
