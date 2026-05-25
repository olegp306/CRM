import { describe, expect, it } from "vitest";
import { classifyIntent } from "./classify-intent";
import {
  createOnboardingFeedbackContent,
  createOnboardingAssistantMessage,
  createOnboardingConversationFeedbackContent,
  createRussianOnboardingAssistantMessage,
  findOnboardingQuestion,
  getCurrentOnboardingBrief,
  isTranslationOrLanguageSwitchRequest,
  onboardingQuestions
} from "./onboarding";

describe("onboarding assistant helpers", () => {
  it("exposes stable guided questions", () => {
    expect(onboardingQuestions.map((question) => question.id)).toEqual([
      "gmail-access",
      "telegram-message-batch",
      "missing-data-purpose",
      "table-design-review",
      "loop-one-priority"
    ]);
    expect(findOnboardingQuestion("telegram-message-batch")?.moduleContext).toBe("leads");
    expect(findOnboardingQuestion("gmail-access")?.moduleContext).toBe("settings");
  });

  it("summarizes current product context with the active app version", () => {
    expect(getCurrentOnboardingBrief()).toMatchObject({
      appVersion: "0.1.5",
      completed: expect.arrayContaining([expect.stringContaining("Loop 1")]),
      planned: expect.arrayContaining([expect.stringContaining("Gmail")])
    });
  });

  it("maps free-form answers into feature-request classified content", () => {
    const question = findOnboardingQuestion("loop-one-priority");

    expect(question).not.toBeNull();
    const content = createOnboardingFeedbackContent({
      question: question!,
      answer: "I need a clearer proposal workflow before sending KP."
    });

    expect(content).toContain("Feature request from onboarding");
    expect(content).toContain("Client answer: I need a clearer proposal workflow before sending KP.");
    expect(classifyIntent(content)).toBe("feature_request");
  });

  it("builds a friendly assistant onboarding message with current questions", () => {
    const message = createOnboardingAssistantMessage();

    expect(message).toContain("Hi, I am Oleg's assistant.");
    expect(message).toContain("What works now:");
    expect(message).toContain("Current plan:");
    expect(message).toContain("Please answer these questions in one message");
    expect(message).toContain("Gmail or Google account");
    expect(message).toContain("pass your answers to the developers");
  });

  it("maps one combined onboarding answer into feature-request classified content", () => {
    const content = createOnboardingConversationFeedbackContent("Gmail is katya@example.com. Multi-message Telegram leads are useful.");

    expect(content).toContain("Feature request from onboarding conversation.");
    expect(content).toContain("katya@example.com");
    expect(classifyIntent(content)).toBe("feature_request");
  });

  it("detects translation requests and builds a Russian onboarding message", () => {
    expect(isTranslationOrLanguageSwitchRequest("Переведи предыдущее сообщение на русский")).toBe(true);
    expect(createRussianOnboardingAssistantMessage()).toContain("Привет, я помощник Олега");
    expect(createRussianOnboardingAssistantMessage()).toContain("Ответь, пожалуйста, одним сообщением");
  });
});
