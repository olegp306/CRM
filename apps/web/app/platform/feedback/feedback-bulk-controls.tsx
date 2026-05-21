"use client";

import { bulkUpdateFeedbackStatusAction } from "@/app/(app)/assistant/actions";
import type { FeedbackTriageEvent, PlatformFeedbackFilters } from "@app/assistant";
import { useTransition } from "react";

const controls: Array<{ label: string; event: FeedbackTriageEvent }> = [
  { label: "Bulk triage", event: "triage" },
  { label: "Bulk plan", event: "plan" },
  { label: "Bulk archive", event: "archive" }
];

export function FeedbackBulkControls({
  workspaceId,
  filters
}: {
  workspaceId: string;
  filters: PlatformFeedbackFilters;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      {controls.map((control) => (
        <button
          key={control.event}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await bulkUpdateFeedbackStatusAction({ workspaceId, filters, event: control.event });
            })
          }
          className="h-8 rounded-lg border border-neutral-700 px-3 text-left text-xs font-semibold text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {control.label}
        </button>
      ))}
    </div>
  );
}
