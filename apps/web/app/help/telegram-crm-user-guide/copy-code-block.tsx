"use client";

import { useState } from "react";

export function CopyCodeBlock({ text }: { text: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    const copied = await copyText(text);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  const label =
    copyState === "copied" ? "Скопировано" : copyState === "failed" ? "Выделите вручную" : "Скопировать";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Пример</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-emerald-50 hover:text-emerald-900"
          aria-label="Скопировать пример"
          aria-live="polite"
        >
          {label}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-sm leading-6 whitespace-pre-wrap">
        <code>{text}</code>
      </pre>
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Local HTTP/IP pages can block the Clipboard API, so use the legacy fallback.
  }

  return fallbackCopyText(text);
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
