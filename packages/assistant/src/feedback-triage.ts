import type { FeedbackItemStatus } from "./feedback-item";

export type FeedbackTriageEvent = "triage" | "plan" | "transfer" | "decline" | "archive";

const transitions: Record<FeedbackItemStatus, Partial<Record<FeedbackTriageEvent, FeedbackItemStatus>>> = {
  new: {
    triage: "triaged",
    plan: "planned",
    decline: "declined",
    archive: "archived"
  },
  triaged: {
    plan: "planned",
    decline: "declined",
    archive: "archived"
  },
  planned: {
    transfer: "transferred",
    archive: "archived"
  },
  transferred: {
    archive: "archived"
  },
  declined: {
    archive: "archived"
  },
  archived: {}
};

export function transitionFeedbackStatus(status: FeedbackItemStatus, event: FeedbackTriageEvent): FeedbackItemStatus {
  const nextStatus = transitions[status][event];

  if (!nextStatus) {
    throw new Error(`Cannot ${event} feedback from ${status}`);
  }

  return nextStatus;
}

export function canTransitionFeedbackStatus(status: FeedbackItemStatus, event: FeedbackTriageEvent): boolean {
  return Boolean(transitions[status][event]);
}
