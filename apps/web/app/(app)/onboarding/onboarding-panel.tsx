"use client";

import type { OnboardingBrief, OnboardingQuestion } from "@app/assistant";
import { CheckCircle2, Circle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { submitOnboardingAnswerAction } from "./actions";

type OnboardingPanelProps = {
  brief: OnboardingBrief;
  questions: OnboardingQuestion[];
};

type SavedAnswer = {
  questionId: string;
  title: string;
  moduleContext: string;
  status: string;
};

export function OnboardingPanel({ brief, questions }: OnboardingPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId] = useState(() => `onboarding-thread-${Date.now()}`);
  const activeQuestion = questions[activeIndex];
  const savedQuestionIds = useMemo(() => new Set(savedAnswers.map((item) => item.questionId)), [savedAnswers]);

  async function submitAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeQuestion || !answer.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const messageId = `onboarding-message-${activeQuestion.id}-${Date.now()}`;
      const result = await submitOnboardingAnswerAction({
        questionId: activeQuestion.id,
        answer,
        threadId,
        messageId
      });

      setSavedAnswers((current) => [
        ...current.filter((item) => item.questionId !== activeQuestion.id),
        {
          questionId: activeQuestion.id,
          title: activeQuestion.title,
          moduleContext: result.feedback?.moduleContext ?? activeQuestion.moduleContext,
          status: result.feedback?.status ?? "new"
        }
      ]);
      setAnswer("");

      if (activeIndex < questions.length - 1) {
        setActiveIndex(activeIndex + 1);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save onboarding answer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current onboarding</p>
            <h1 className="mt-1 text-2xl font-semibold">Client onboarding interview</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Ask structured questions, collect free-form answers, and save each answer into the platform feedback queue as a future feature request.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">v{brief.appVersion}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="grid gap-4">
          <section className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold">Already working</h2>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {brief.completed.map((item) => (
                <p key={item} className="leading-5">{item}</p>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold">Current plan</h2>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {brief.planned.map((item) => (
                <p key={item} className="leading-5">{item}</p>
              ))}
            </div>
          </section>
        </aside>

        <div className="grid gap-4">
          <section className="rounded-lg border border-border bg-white p-4">
            <div className="grid gap-2 md:grid-cols-5">
              {questions.map((question, index) => {
                const isSaved = savedQuestionIds.has(question.id);
                const isActive = question.id === activeQuestion?.id;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`flex min-h-16 items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                      isActive ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {isSaved ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{question.title}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {activeQuestion ? (
            <section className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{activeQuestion.moduleContext}</p>
                <h2 className="mt-1 text-lg font-semibold">{activeQuestion.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeQuestion.prompt}</p>
              </div>

              <form onSubmit={submitAnswer} className="p-4">
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="min-h-40 w-full resize-y rounded-lg border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  placeholder="Write the client's answer in free form. Details, examples, and rough wording are useful here."
                />
                {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Saved answers appear in Platform Feedback as feature requests.</p>
                  <button
                    type="submit"
                    disabled={!answer.trim() || submitting}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {submitting ? "Saving" : "Save answer"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold">Saved onboarding feedback</h2>
            <div className="mt-3 grid gap-2">
              {savedAnswers.length > 0 ? (
                savedAnswers.map((item) => (
                  <div key={item.questionId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{item.moduleContext} / {item.status}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No onboarding answers saved yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
