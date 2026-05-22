import { describe, expect, it } from "vitest";
import { classifyIntent } from "./classify-intent";
import {
  createOnboardingFeedbackContent,
  findOnboardingQuestion,
  getCurrentOnboardingBrief,
  onboardingQuestions
} from "./onboarding";

describe("onboarding assistant helpers", () => {
  it("exposes stable guided questions", () => {
    expect(onboardingQuestions.map((question) => question.id)).toEqual([
      "workflow-gaps",
      "lead-intake",
      "project-flow",
      "assistant-behavior",
      "priority"
    ]);
    expect(findOnboardingQuestion("lead-intake")?.moduleContext).toBe("leads");
  });

  it("summarizes current product context with the active app version", () => {
    expect(getCurrentOnboardingBrief()).toMatchObject({
      appVersion: "0.1.1",
      completed: expect.arrayContaining([expect.stringContaining("Telegram lead intake")]),
      planned: expect.arrayContaining([expect.stringContaining("lead table views")])
    });
  });

  it("maps free-form answers into feature-request classified content", () => {
    const question = findOnboardingQuestion("priority");

    expect(question).not.toBeNull();
    const content = createOnboardingFeedbackContent({
      question: question!,
      answer: "I need a clearer proposal workflow before sending KP."
    });

    expect(content).toContain("Feature request from onboarding");
    expect(content).toContain("Client answer: I need a clearer proposal workflow before sending KP.");
    expect(classifyIntent(content)).toBe("feature_request");
  });
});
