import { describe, expect, it } from "vitest";
import { classifyLeadStandardness } from "./standard-classifier";

describe("classifyLeadStandardness", () => {
  it("classifies standard leads when request type and BGF fit the price table", () => {
    expect(classifyLeadStandardness({ requestType: "new_build", bgfM2: 150 })).toEqual({
      isStandard: true,
      reason: "standard_price_table_match"
    });
  });

  it("marks missing BGF as manual pricing", () => {
    expect(classifyLeadStandardness({ requestType: "new_build" })).toEqual({
      isStandard: false,
      reason: "missing_bgf"
    });
  });

  it("marks out-of-range or unsupported request types as manual pricing", () => {
    expect(classifyLeadStandardness({ requestType: "new_build", bgfM2: 300 })).toEqual({
      isStandard: false,
      reason: "bgf_out_of_standard_range"
    });
    expect(classifyLeadStandardness({ requestType: "renovation", bgfM2: 150 })).toEqual({
      isStandard: false,
      reason: "unsupported_request_type"
    });
  });
});
