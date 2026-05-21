import { describe, expect, it } from "vitest";
import { transitionFeedbackStatus } from "./feedback-triage";

describe("feedback triage transitions", () => {
  it("moves new feedback into triaged, planned, declined, or archived states", () => {
    expect(transitionFeedbackStatus("new", "triage")).toBe("triaged");
    expect(transitionFeedbackStatus("new", "plan")).toBe("planned");
    expect(transitionFeedbackStatus("new", "decline")).toBe("declined");
    expect(transitionFeedbackStatus("new", "archive")).toBe("archived");
  });

  it("allows planned feedback to be transferred or archived", () => {
    expect(transitionFeedbackStatus("planned", "transfer")).toBe("transferred");
    expect(transitionFeedbackStatus("planned", "archive")).toBe("archived");
  });

  it("rejects invalid transitions", () => {
    expect(() => transitionFeedbackStatus("declined", "plan")).toThrow("Cannot plan feedback from declined");
  });
});
