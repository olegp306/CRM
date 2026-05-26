import { describe, expect, it } from "vitest";
import { getAssistantSelectedRecordIds, shouldUseOnboardingAssistantAction } from "./assistant-route-context";

describe("getAssistantSelectedRecordIds", () => {
  it("captures the deep-linked lead as the selected assistant record on the leads page", () => {
    expect(getAssistantSelectedRecordIds("/leads", new URLSearchParams("leadId=L-2026-004"))).toEqual(["L-2026-004"]);
  });

  it("keeps the assistant context broad when the leads page has no selected lead", () => {
    expect(getAssistantSelectedRecordIds("/leads", new URLSearchParams())).toEqual([]);
  });

  it("ignores lead deep links outside the leads module", () => {
    expect(getAssistantSelectedRecordIds("/projects", new URLSearchParams("leadId=L-2026-004"))).toEqual([]);
  });
});

describe("shouldUseOnboardingAssistantAction", () => {
  it("keeps ordinary first replies in the onboarding flow", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 0,
        content: "The lead table feels good, but I need columns for budget.",
        attachmentCount: 0
      })
    ).toBe(true);
  });

  it("routes help commands through the shared assistant even in a new thread", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 0,
        content: "/help",
        attachmentCount: 0
      })
    ).toBe(false);
  });

  it("routes new lead commands through the shared assistant even in a new thread", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 0,
        content: "/newlead",
        attachmentCount: 0
      })
    ).toBe(false);
  });

  it("routes first-message source material through the shared CRM assistant", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 0,
        content: "Create a lead from this client request: Irina needs a KP for BGF 195 m2.",
        attachmentCount: 0
      })
    ).toBe(false);
  });

  it("routes first-message uploads through the shared CRM assistant", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 0,
        content: "Please review this client request",
        attachmentCount: 1
      })
    ).toBe(false);
  });

  it("uses the shared assistant after the onboarding thread has history", () => {
    expect(
      shouldUseOnboardingAssistantAction({
        historyLength: 1,
        content: "Can you check lead L-2026-004?",
        attachmentCount: 0
      })
    ).toBe(false);
  });
});
