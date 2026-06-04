"use client";

import { useState } from "react";

export function CopyCodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Пример</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-emerald-50 hover:text-emerald-900"
          aria-label="Скопировать пример"
        >
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-sm leading-6 whitespace-pre-wrap">
        <code>{text}</code>
      </pre>
    </div>
  );
}
