export type ActionConfirmationStatus = "draft" | "awaiting_confirmation" | "confirmed" | "cancelled" | "executed" | "failed";
export type ActionConfirmationEvent = "preview" | "confirm" | "cancel" | "execute" | "fail";

const transitions: Record<ActionConfirmationStatus, Partial<Record<ActionConfirmationEvent, ActionConfirmationStatus>>> = {
  draft: {
    preview: "awaiting_confirmation"
  },
  awaiting_confirmation: {
    confirm: "confirmed",
    cancel: "cancelled"
  },
  confirmed: {
    execute: "executed",
    fail: "failed"
  },
  cancelled: {},
  executed: {},
  failed: {}
};

export function advanceActionConfirmation(
  status: ActionConfirmationStatus,
  event: ActionConfirmationEvent
): ActionConfirmationStatus {
  const nextStatus = transitions[status][event];

  if (!nextStatus) {
    throw new Error(`Cannot ${event} action from ${status}`);
  }

  return nextStatus;
}
