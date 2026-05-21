"use client";

import { updateFeedbackStatusAction } from "@/app/(app)/assistant/actions";
import type { FeedbackTriageEvent } from "@app/assistant";
import { useTransition } from "react";

const controls: Array<{ label: string; event: FeedbackTriageEvent }> = [
  { label: "Triage", event: "triage" },
  { label: "Plan", event: "plan" },
  { label: "Decline", event: "decline" },
  { label: "Archive", event: "archive" }
];

export function FeedbackTriageControls({
  workspaceId,
  sourceMessageId
}: {
  workspaceId: string;
  sourceMessageId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-1">
      {controls.map((control) => (
        <button
          key={control.event}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateFeedbackStatusAction({ workspaceId, sourceMessageId, event: control.event });
            })
          }
          className="h-7 rounded-md border border-neutral-700 px-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {control.label}
        </button>
      ))}
    </div>
  );
}
