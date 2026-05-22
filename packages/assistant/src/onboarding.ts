import { currentAppMetadata } from "@app/core";

export type OnboardingQuestion = {
  id: string;
  title: string;
  prompt: string;
  moduleContext: "onboarding" | "leads" | "projects" | "outreach" | "assistant" | "settings";
};

export type OnboardingBrief = {
  appVersion: string;
  completed: string[];
  planned: string[];
};

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: "gmail-access",
    title: "Gmail access",
    prompt: "Katya, please send the Gmail or Google account that should be allowed to access the CRM when we restrict the public staging app.",
    moduleContext: "settings"
  },
  {
    id: "telegram-message-batch",
    title: "Telegram message batches",
    prompt: "Telegram can already create leads from messages. Should it also create one lead from several consecutive Telegram messages that belong to the same client request?",
    moduleContext: "leads"
  },
  {
    id: "missing-data-purpose",
    title: "Missing data purpose",
    prompt: "The form says Telegram will ask for additional missing data. Missing for what exactly: lead qualification, KP/proposal generation, project setup, pricing, or another decision?",
    moduleContext: "leads"
  },
  {
    id: "table-design-review",
    title: "Table design review",
    prompt: "Please check the current table design for clients, leads, projects, and cold targets. What feels clear, unclear, too much, or missing for your daily work?",
    moduleContext: "onboarding"
  },
  {
    id: "loop-one-priority",
    title: "Loop one priority",
    prompt: "For the first loop, we are focusing on Telegram lead intake and web editing of created leads. What should be fixed or added first so this loop becomes useful for real work?",
    moduleContext: "onboarding"
  }
];

export function getCurrentOnboardingBrief(): OnboardingBrief {
  return {
    appVersion: currentAppMetadata.version,
    completed: [
      "Loop 1 is the current focus: Telegram can parse incoming messages and create leads.",
      "Created leads can already be viewed and edited in the web form.",
      "Editable CRM tables exist for clients, leads, projects, and cold targets.",
      "The web assistant can collect onboarding answers as versioned feature requests in the platform feedback inbox.",
      "The app can show the current version so support and feature requests can be traced back to a release."
    ],
    planned: [
      "Restrict staging access to specific Google/Gmail accounts.",
      "Decide whether Telegram should merge several consecutive messages into one lead.",
      "Clarify which business decision the missing-data questions should support.",
      "Improve lead table views with split, popup, and inline editing modes.",
      "Use Katya's onboarding answers to prioritize the next feature branches."
    ]
  };
}

export function createOnboardingAssistantMessage({
  brief = getCurrentOnboardingBrief(),
  questions = onboardingQuestions
}: {
  brief?: OnboardingBrief;
  questions?: OnboardingQuestion[];
} = {}): string {
  return [
    "Hi, I am Oleg's assistant. Welcome, and thank you for checking the CRM.",
    "",
    "What works now:",
    ...brief.completed.map((item) => `- ${item}`),
    "",
    "Current plan:",
    ...brief.planned.map((item) => `- ${item}`),
    "",
    "Please answer these questions in one message, in free form:",
    ...questions.map((question, index) => `${index + 1}. ${question.prompt}`),
    "",
    "I know the current implementation plan. I will pass your answers to the developers and save them as feature requests."
  ].join("\n");
}

export function findOnboardingQuestion(questionId: string): OnboardingQuestion | null {
  return onboardingQuestions.find((question) => question.id === questionId) ?? null;
}

export function createOnboardingFeedbackContent({
  question,
  answer
}: {
  question: OnboardingQuestion;
  answer: string;
}): string {
  const cleanAnswer = answer.trim();

  return [
    `Feature request from onboarding: ${question.title}.`,
    `Question: ${question.prompt}`,
    `Client answer: ${cleanAnswer}`
  ].join("\n");
}

export function createOnboardingConversationFeedbackContent(answer: string): string {
  const cleanAnswer = answer.trim();

  return [
    "Feature request from onboarding conversation.",
    "Context: the client answered the current onboarding questions inside the web assistant.",
    `Client answers: ${cleanAnswer}`
  ].join("\n");
}
