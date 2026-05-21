import { MessageSquareText } from "lucide-react";

export function AssistantButton() {
  return (
    <button
      type="button"
      className="fixed bottom-4 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      aria-label="Open Assistant"
      title="Open Assistant"
    >
      <MessageSquareText aria-hidden="true" className="h-4 w-4" />
      Assistant
    </button>
  );
}
