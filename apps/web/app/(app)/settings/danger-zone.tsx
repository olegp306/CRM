"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  clearLeadTableAction,
  initialClearLeadTableActionState,
  type ClearLeadTableActionState
} from "./actions";

export function SettingsDangerZone() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState<ClearLeadTableActionState, FormData>(
    clearLeadTableAction,
    initialClearLeadTableActionState
  );

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
    }
  }, [state.status]);

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-red-950">Clear leads table</h2>
          <p className="mt-2 text-sm text-red-900">
            This deletes lead rows only for the current workspace. Use it to reset production test intake before sending old source materials again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="inline-flex items-center justify-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
        >
          Delete lead data
        </button>
      </div>
      {state.message ? (
        <p className={`mt-3 text-sm ${state.status === "success" ? "text-red-950" : "text-red-700"}`}>{state.message}</p>
      ) : null}
      <dialog ref={dialogRef} className="w-[min(92vw,420px)] rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40">
        <form action={formAction} className="grid gap-4 p-5">
          <div>
            <h3 className="text-lg font-semibold">Confirm lead table deletion</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the password to permanently delete lead rows for this workspace. Clients, projects, templates, and files are not deleted.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              autoComplete="off"
              className="rounded-md border border-border px-3 py-2 text-sm"
              required
            />
          </label>
          {state.status === "error" && state.message ? <p className="text-sm font-medium text-red-700">{state.message}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Deleting..." : "Delete lead data"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
