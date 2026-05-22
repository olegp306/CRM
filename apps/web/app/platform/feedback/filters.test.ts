import { describe, expect, it } from "vitest";
import { parsePlatformFeedbackFilters } from "./filters";

describe("parsePlatformFeedbackFilters", () => {
  it("accepts supported feedback status, type, and app version values", () => {
    expect(parsePlatformFeedbackFilters({ status: "planned", type: "feature_request", appVersion: "0.1.0" })).toEqual({
      status: "planned",
      type: "feature_request",
      appVersion: "0.1.0"
    });
  });

  it("ignores unsupported filter values", () => {
    expect(parsePlatformFeedbackFilters({ status: "done", type: "crm_action", appVersion: "latest" })).toEqual({});
  });
});
