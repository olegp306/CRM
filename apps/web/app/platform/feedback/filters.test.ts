import { describe, expect, it } from "vitest";
import { parsePlatformFeedbackFilters } from "./filters";

describe("parsePlatformFeedbackFilters", () => {
  it("accepts supported feedback status and type values", () => {
    expect(parsePlatformFeedbackFilters({ status: "planned", type: "feature_request" })).toEqual({
      status: "planned",
      type: "feature_request"
    });
  });

  it("ignores unsupported filter values", () => {
    expect(parsePlatformFeedbackFilters({ status: "done", type: "crm_action" })).toEqual({});
  });
});
