"use client";

import { confirmAssistantActionAction, submitAssistantMessageAction, submitOnboardingAssistantMessageAction } from "@/app/(app)/assistant/actions";
import { createAssistantAttachmentFromFile } from "@/app/(app)/assistant/upload-source-material";
import { captureAssistantContext, createOnboardingAssistantMessage, type AssistantChannelAttachment, type AssistantSubmissionResult } from "@app/assistant";
import { appendAssistantExchange, getAssistantModuleFromRoute, type AssistantConversationEntry } from "@app/assistant";
import { MessageSquareText, Mic, Paperclip, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAssistantExecutionButtons, getAssistantExecutionLabel, type AssistantExecutionButton } from "./assistant-execution-label";
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
  const [executionButtons, setExecutionButtons] = useState<AssistantExecutionButton[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AssistantChannelAttachment[]>([]);
  const latestResult = history.length > 0 ? result : null;
  const onboardingMessage = createOnboardingAssistantMessage();
  const hasUnreadOnboarding = !open && history.length === 0;

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments = await Promise.all(files.map(createAssistantAttachmentFromFile));
    setAttachments((current) => [...current, ...nextAttachments]);
    event.target.value = "";
  }

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
        messageId,
        attachments
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
      setExecutionButtons([]);
      setText("");
      setAttachments([]);
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
    setExecutionButtons([]);
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
    setExecutionButtons(getAssistantExecutionButtons(execution));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        aria-label={hasUnreadOnboarding ? "Open Assistant, new onboarding message" : "Open Assistant"}
        title={hasUnreadOnboarding ? "Open Assistant, new onboarding message" : "Open Assistant"}
      >
        <MessageSquareText aria-hidden="true" className="h-4 w-4" />
        Assistant
        {hasUnreadOnboarding ? (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" aria-hidden="true" />
        ) : null}
      </button>
      {open ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-white shadow-xl sm:w-[420px]">
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
                {latestResult?.responseButtons.length ? (
                  <div className="flex flex-wrap gap-2">
                    {latestResult.responseButtons.map((button) =>
                      button.url ? (
                        <a
                          key={`${button.label}-${button.url}`}
                          href={button.url}
                          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                        >
                          {button.label}
                        </a>
                      ) : (
                        <button
                          key={`${button.label}-${button.action ?? "button"}`}
                          type="button"
                          onClick={button.action === "confirm" && latestResult.actionPreview ? confirmLatestAction : undefined}
                          disabled={button.action === "confirm" && !latestResult.actionPreview}
                          className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {button.label}
                        </button>
                      )
                    )}
                  </div>
                ) : null}
                {executionButtons.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {executionButtons.map((button) => (
                      <a
                        key={`${button.label}-${button.url}`}
                        href={button.url}
                        className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                      >
                        {button.label}
                      </a>
                    ))}
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
          <form onSubmit={handleSubmit} className="border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-24 w-full resize-none rounded-lg border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder={
                history.length === 0
                  ? "Send text, attach photos/PDFs, or answer onboarding. On mobile, use keyboard dictation."
                  : "Ask about leads, attach photos/PDFs, or add source material. On mobile, use keyboard dictation."
              }
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold">
                <Paperclip aria-hidden="true" className="h-4 w-4" />
                Attach
                <input type="file" multiple accept="image/*,.pdf,.docx,.txt" onChange={handleFilesSelected} className="sr-only" />
              </label>
              <span className="inline-flex min-w-0 flex-1 items-center justify-end gap-1 text-right text-xs text-muted-foreground max-[360px]:basis-full max-[360px]:justify-start max-[360px]:text-left">
                <Mic aria-hidden="true" className="h-4 w-4" />
                Use mobile dictation.
              </span>
            </div>
            {attachments.length > 0 ? (
              <div className="mt-2 grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Files are staged for the next assistant upload step.</p>
                  <button
                    type="button"
                    onClick={() => setAttachments([])}
                    className="h-7 shrink-0 rounded-lg border border-border px-2 text-xs font-semibold"
                  >
                    Clear files
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <span key={attachment.id} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {attachment.fileName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
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
