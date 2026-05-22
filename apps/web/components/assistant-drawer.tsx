"use client";

import { confirmAssistantActionAction, submitAssistantMessageAction, submitOnboardingAssistantMessageAction } from "@/app/(app)/assistant/actions";
import { captureAssistantContext, createOnboardingAssistantMessage, type AssistantSubmissionResult } from "@app/assistant";
import { appendAssistantExchange, getAssistantModuleFromRoute, type AssistantConversationEntry } from "@app/assistant";
import { MessageSquareText, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAssistantExecutionLabel } from "./assistant-execution-label";
import { useWorkspaceSession } from "./workspace-session-provider";

export function AssistantDrawer() {
  const pathname = usePathname();
  const session = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [threadId] = useState(() => `thread-${Date.now()}`);
  const [history, setHistory] = useState<AssistantConversationEntry[]>([]);
  const [result, setResult] = useState<AssistantSubmissionResult | null>(null);
  const [confirmation, setConfirmation] = useState<"idle" | "confirmed" | "cancelled">("idle");
  const [latestMessageId, setLatestMessageId] = useState<string | null>(null);
  const [executionSummary, setExecutionSummary] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const latestResult = history.length > 0 ? result : null;
  const onboardingMessage = createOnboardingAssistantMessage();
  const hasUnreadOnboarding = !open && history.length === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) {
      return;
    }

    setSubmitting(true);
    const submittedAt = Date.now();
    const context = captureAssistantContext({
      workspaceId: session.workspaceId,
      userId: session.userId,
      role: session.role,
      route: pathname,
      module: getAssistantModuleFromRoute(pathname)
    });

    const messageId = `message-${submittedAt}`;
    try {
      const submitAction = history.length === 0 ? submitOnboardingAssistantMessageAction : submitAssistantMessageAction;
      const response = await submitAction({
        context,
        content: text,
        threadId,
        messageId
      });
      const { result: nextResult, saved } = response;
      const displayUserContent =
        "displayUserContent" in response && typeof response.displayUserContent === "string"
          ? response.displayUserContent
          : null;

      setResult(nextResult);
      setHistory((current) =>
        displayUserContent
          ? [
              ...current,
              {
                id: messageId,
                role: "user",
                content: displayUserContent,
                intent: nextResult.message.intent
              },
              {
                id: `${messageId}-response`,
                role: "assistant",
                content: nextResult.response,
                intent: nextResult.message.intent
              }
            ]
          : appendAssistantExchange(current, nextResult, messageId)
      );
      setSavedSummary(`${saved.messageCount} messages, ${saved.feedbackCount} feedback, ${saved.actionCount} actions saved`);
      setLatestMessageId(messageId);
      setConfirmation("idle");
      setExecutionSummary(null);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  function clearThread() {
    setHistory([]);
    setResult(null);
    setConfirmation("idle");
    setLatestMessageId(null);
    setExecutionSummary(null);
    setSavedSummary(null);
  }

  async function confirmLatestAction() {
    if (!latestMessageId) {
      return;
    }

    const { execution } = await confirmAssistantActionAction({
      workspaceId: session.workspaceId,
      messageId: latestMessageId
    });

    setConfirmation("confirmed");
    setExecutionSummary(`Executed: ${getAssistantExecutionLabel(execution)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        aria-label="Open Assistant"
        title="Open Assistant"
      >
        <MessageSquareText aria-hidden="true" className="h-4 w-4" />
        Assistant
        {hasUnreadOnboarding ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            Onboarding
          </span>
        ) : null}
      </button>
      {open ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col border-l border-border bg-white shadow-xl">
          <header className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div>
              <h2 className="text-sm font-semibold">Assistant</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {session.workspaceName}, {session.role} mode. Messages may be reviewed by platform support.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearThread}
                disabled={history.length === 0}
                className="h-8 rounded-lg border border-border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close Assistant"
                title="Close Assistant"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {history.length > 0 ? (
              <div className="grid gap-3">
                {history.map((entry) => (
                  <div key={entry.id}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {entry.role === "user" ? "You" : "Assistant"}
                    </p>
                    <p className={`mt-1 rounded-lg border border-border p-3 text-foreground ${entry.role === "user" ? "bg-muted" : ""}`}>
                      {entry.content}
                    </p>
                  </div>
                ))}
                {latestResult ? (
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Intent: {latestResult.message.intent}</p>
                    <p>Route: {latestResult.message.context.route}</p>
                    <p>Module: {latestResult.message.context.module}</p>
                    {savedSummary ? <p>Memory: {savedSummary}</p> : null}
                  </div>
                ) : null}
                {latestResult?.actionPreview ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">{latestResult.actionPreview.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestResult.actionPreview.changes.length} proposed change, status {latestResult.confirmationStatus}
                    </p>
                    {confirmation === "idle" ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={confirmLatestAction}
                          className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmation("cancelled")}
                          className="h-9 rounded-lg border border-border px-3 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-foreground">{executionSummary ?? `Action ${confirmation}`}</p>
                    )}
                  </div>
                ) : null}
                {latestResult?.feedback ? (
                  <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                    Feedback draft: {latestResult.feedback.type}, {latestResult.feedback.status}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Assistant</p>
                  <p className="mt-1 whitespace-pre-line rounded-lg border border-border bg-muted p-3 leading-6 text-foreground">
                    {onboardingMessage}
                  </p>
                </div>
                <p className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                  You can answer all questions in one message. I will save the answer for Oleg and the development team.
                </p>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="border-t border-border p-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-24 w-full resize-none rounded-lg border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder={history.length === 0 ? "Answer the onboarding questions here in one message." : "Type here. On mobile, use your keyboard dictation microphone."}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="mt-2 h-10 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending" : "Send"}
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
