"use client";

import { planReleaseFeedbackAction } from "@/app/(app)/assistant/actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ReleaseNotesActions({
  workspaceId,
  appVersion
}: {
  workspaceId: string;
  appVersion: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await planReleaseFeedbackAction({ workspaceId, appVersion });
          router.refresh();
        })
      }
      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      Plan release items
    </button>
  );
}
