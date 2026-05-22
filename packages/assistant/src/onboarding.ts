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
    id: "workflow-gaps",
    title: "Workflow gaps",
    prompt: "Which parts of your real client workflow are still missing or unclear in this CRM?",
    moduleContext: "onboarding"
  },
  {
    id: "lead-intake",
    title: "Lead intake",
    prompt: "When a new lead arrives from Telegram or manually, what should the CRM ask, infer, or prepare for you?",
    moduleContext: "leads"
  },
  {
    id: "project-flow",
    title: "Project flow",
    prompt: "After a lead becomes a project, what statuses, tasks, documents, or handoffs should be visible first?",
    moduleContext: "projects"
  },
  {
    id: "assistant-behavior",
    title: "Assistant behavior",
    prompt: "What should the assistant know, explain, or do differently while you use the app?",
    moduleContext: "assistant"
  },
  {
    id: "priority",
    title: "Priority",
    prompt: "If we could build only one improvement next, what should it be and why?",
    moduleContext: "onboarding"
  }
];

export function getCurrentOnboardingBrief(): OnboardingBrief {
  return {
    appVersion: currentAppMetadata.version,
    completed: [
      "Telegram lead intake can create leads and preserve source context.",
      "Editable CRM tables exist for clients, leads, projects, and cold targets.",
      "Assistant messages can create versioned feedback, action previews, and platform inbox rows.",
      "Version metadata is visible in the app shell and attached to support or feature feedback."
    ],
    planned: [
      "Improve lead table views with split, popup, and inline editing modes.",
      "Expand project and document execution loops beyond the first working flows.",
      "Use onboarding answers to prioritize the next feature branches."
    ]
  };
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
