import { getCurrentOnboardingBrief, onboardingQuestions } from "@app/assistant";
import { OnboardingPanel } from "./onboarding-panel";

export default function OnboardingPage() {
  return <OnboardingPanel brief={getCurrentOnboardingBrief()} questions={onboardingQuestions} />;
}
