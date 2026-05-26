# Unified Assistant Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web Assistant and Telegram bot feel like two channels of the same CRM assistant, sharing intent routing, lead intake, lead updates, help answers, source materials, and conservative feedback capture.

**Architecture:** Introduce a shared assistant channel engine in `packages/assistant` that receives normalized channel messages from Telegram and Web. Telegram remains the production behavior reference; Web gradually calls the shared engine instead of its current feedback-first submission path. Channel adapters keep channel-specific UI, buttons, uploads, and reply mechanics separate from shared business decisions.

**Tech Stack:** TypeScript, Next.js App Router server actions, Prisma stores, Vitest, existing Telegram worker/parser, existing assistant persistence/action preview, existing object storage attachment model.

---

## File Structure

- Create `packages/assistant/src/channel-message.ts`  
  Defines normalized channel input, attachments, channel names, replies, and assistant output.

- Create `packages/assistant/src/channel-engine.ts`  
  Routes normalized messages into help, lead intake/update, CRM action preview, or feedback capture.

- Create `packages/assistant/src/channel-engine.test.ts`  
  Locks shared behavior before wiring Telegram and Web.

- Modify `packages/assistant/src/classify-intent.ts` and `packages/assistant/src/classify-intent.test.ts`  
  Make feedback classification more conservative and add explicit conversational/help intents.

- Modify `packages/assistant/src/submission.ts` and `packages/assistant/src/submission.test.ts`  
  Preserve current web action preview API while delegating non-special cases to the shared engine.

- Modify `packages/integrations/src/telegram/telegram-worker.ts` and `packages/integrations/src/telegram/telegram-worker.test.ts`  
  Keep Telegram behavior stable, but source welcome/help text and intent rules from shared assistant functions.

- Modify `apps/web/components/assistant-drawer.tsx`  
  Add file/photo upload controls, clearer voice placeholder, and route messages through the unified assistant action.

- Modify `apps/web/app/(app)/assistant/actions.ts`  
  Add a web channel submission action that accepts attachments metadata/base64 and calls the shared engine.

- Create `apps/web/app/(app)/assistant/upload-source-material.ts`  
  Small helper to normalize browser file uploads into assistant channel attachments.

- Modify `apps/web/components/assistant-drawer.test.tsx` or create `apps/web/components/assistant-drawer-source-input.test.tsx` if the project has component test support available. If component tests are not configured, add source-level tests under `packages/assistant` and verify with web typecheck.

---

### Task 1: Define Shared Channel Message Types

**Files:**
- Create: `packages/assistant/src/channel-message.ts`
- Modify: `packages/assistant/src/index.ts`
- Test: `packages/assistant/src/channel-engine.test.ts`

- [ ] **Step 1: Create the normalized channel contracts**

Add `packages/assistant/src/channel-message.ts`:

```ts
export type AssistantChannel = "web" | "telegram";

export type AssistantChannelAttachment = {
  id: string;
  kind: "photo" | "pdf" | "docx" | "text" | "other";
  fileName: string;
  mimeType: string;
  base64?: string;
  storageKey?: string;
  sourceUrl?: string;
};

export type AssistantChannelReplyContext = {
  sourceChannel: AssistantChannel;
  sourceMessageId: string;
  leadId?: string;
};

export type AssistantChannelContext = {
  workspaceId: string;
  userId: string;
  role: string;
  route?: string;
  module?: string;
  selectedRecordIds?: string[];
};

export type AssistantChannelMessage = {
  channel: AssistantChannel;
  threadId: string;
  messageId: string;
  content: string;
  receivedAt: string;
  context: AssistantChannelContext;
  attachments: AssistantChannelAttachment[];
  replyTo?: AssistantChannelReplyContext;
};

export type AssistantChannelResponseButton = {
  label: string;
  url?: string;
  action?: "confirm" | "cancel" | "open_upload" | "open_lead" | "send_kp" | "mark_kp_sent" | "undo_kp_sent";
};

export type AssistantChannelResponse = {
  text: string;
  intent:
    | "help"
    | "lead_intake"
    | "lead_update"
    | "crm_action"
    | "support_request"
    | "bug_report"
    | "feature_request"
    | "ux_feedback"
    | "business_process_note"
    | "other";
  feedbackType?: "support_request" | "bug_report" | "feature_request" | "ux_feedback" | "permission_blocked";
  buttons: AssistantChannelResponseButton[];
  shouldPersistFeedback: boolean;
};
```

- [ ] **Step 2: Export the contracts**

Modify `packages/assistant/src/index.ts`:

```ts
export * from "./channel-message";
```

- [ ] **Step 3: Add a compile guard test**

Create the first test in `packages/assistant/src/channel-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AssistantChannelMessage } from "./channel-message";

describe("assistant channel message contracts", () => {
  it("represents a web message with attachments and selected CRM context", () => {
    const message: AssistantChannelMessage = {
      channel: "web",
      threadId: "thread-1",
      messageId: "message-1",
      content: "Create a lead from this PDF",
      receivedAt: "2026-05-26T08:00:00.000Z",
      context: {
        workspaceId: "workspace-demo",
        userId: "user-demo",
        role: "admin",
        route: "/leads",
        module: "leads",
        selectedRecordIds: ["L-2026-004"]
      },
      attachments: [
        {
          id: "attachment-1",
          kind: "pdf",
          fileName: "lead.pdf",
          mimeType: "application/pdf",
          base64: "JVBERi0x"
        }
      ]
    };

    expect(message.channel).toBe("web");
    expect(message.attachments[0]?.kind).toBe("pdf");
  });
});
```

- [ ] **Step 4: Run the new test**

Run: `pnpm --filter @app/assistant test -- "channel-engine.test.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/channel-message.ts packages/assistant/src/channel-engine.test.ts packages/assistant/src/index.ts
git commit -m "feat: add assistant channel message contracts"
```

---

### Task 2: Make Intent Classification Conversational Before Feedback

**Files:**
- Modify: `packages/assistant/src/classify-intent.ts`
- Modify: `packages/assistant/src/classify-intent.test.ts`

- [ ] **Step 1: Add failing intent tests for help and non-feedback conversation**

Add tests to `packages/assistant/src/classify-intent.test.ts`:

```ts
it("classifies identity and capability questions as support requests, not feature requests", () => {
  expect(classifyIntent("Кто ты и что умеешь делать?")).toBe("support_request");
  expect(classifyIntent("who are you and what can you do?")).toBe("support_request");
});

it("does not convert translation or ordinary lead questions into feature requests", () => {
  expect(classifyIntent("Переведи предыдущее сообщение на русский")).toBe("support_request");
  expect(classifyIntent("Почему у лида L-2026-004 нет коммерческого предложения?")).toBe("support_request");
});

it("captures explicit product requests as feature requests", () => {
  expect(classifyIntent("Добавьте кнопку для сравнения версий коммерческого предложения")).toBe("feature_request");
  expect(classifyIntent("It would be nice to upload several lead photos in the web assistant")).toBe("feature_request");
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `pnpm --filter @app/assistant test -- "classify-intent.test.ts"`  
Expected before implementation: at least one new test fails because current rules are too broad or miss Russian conversational phrases.

- [ ] **Step 3: Update classifier order and patterns**

Modify `packages/assistant/src/classify-intent.ts`:

```ts
export type AssistantIntent =
  | "crm_action"
  | "support_request"
  | "bug_report"
  | "feature_request"
  | "ux_feedback"
  | "business_process_note"
  | "permission_blocked"
  | "other";

export function classifyIntent(message: string): AssistantIntent {
  const text = message.toLowerCase();

  if (/(bug|broken|does not work|error|ne rabotaet|oshibka|не работает|ошибка)/.test(text)) {
    return "bug_report";
  }

  if (
    /(who are you|what can you do|help|how do i|translate|переведи|кто ты|что умеешь|помоги|как сделать|почему|зачем)/.test(text)
  ) {
    return "support_request";
  }

  if (
    /(please add|would be nice|i want to add|feature request|добавьте|хочу добавить|хотелось бы|сделайте возможность|нужна функция)/.test(text)
  ) {
    return "feature_request";
  }

  if (/(create|add|generate|schedule|update|mark|set|record|создай|добавь|сгенерируй|поставь|отметь|запиши)/.test(text)) {
    return "crm_action";
  }

  if (/(confusing|uncomfortable|неудобно|непонятно)/.test(text)) {
    return "ux_feedback";
  }

  return "other";
}
```

- [ ] **Step 4: Run classifier tests**

Run: `pnpm --filter @app/assistant test -- "classify-intent.test.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/classify-intent.ts packages/assistant/src/classify-intent.test.ts
git commit -m "fix: make assistant feedback classification conservative"
```

---

### Task 3: Add Shared Help and Capability Responses

**Files:**
- Create: `packages/assistant/src/channel-engine.ts`
- Modify: `packages/assistant/src/channel-engine.test.ts`
- Modify: `packages/assistant/src/index.ts`

- [ ] **Step 1: Add failing tests for web and Telegram help parity**

Append to `packages/assistant/src/channel-engine.test.ts`:

```ts
import { createAssistantChannelResponse } from "./channel-engine";

const baseMessage = {
  threadId: "thread-1",
  messageId: "message-1",
  receivedAt: "2026-05-26T08:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "user-demo",
    role: "admin",
    route: "/leads",
    module: "leads"
  },
  attachments: []
};

describe("assistant channel engine", () => {
  it("answers capability questions consistently in web", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Кто ты и что умеешь?"
    });

    expect(result.intent).toBe("help");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.text).toContain("I can create and update leads");
  });

  it("answers capability questions consistently in Telegram", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "telegram",
      content: "/help"
    });

    expect(result.intent).toBe("help");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.text).toContain("I can create and update leads");
  });
});
```

- [ ] **Step 2: Implement shared help response**

Create `packages/assistant/src/channel-engine.ts`:

```ts
import { classifyIntent } from "./classify-intent";
import type { AssistantChannelMessage, AssistantChannelResponse } from "./channel-message";

export function createAssistantChannelResponse(message: AssistantChannelMessage): AssistantChannelResponse {
  const intent = classifyIntent(message.content);

  if (isHelpMessage(message.content, intent)) {
    return {
      intent: "help",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      text: createSharedCapabilityMessage(message.channel)
    };
  }

  if (intent === "feature_request" || intent === "bug_report" || intent === "ux_feedback" || intent === "support_request") {
    return {
      intent,
      shouldPersistFeedback: intent !== "support_request",
      feedbackType: intent === "support_request" ? undefined : intent,
      buttons: [],
      text:
        intent === "support_request"
          ? "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
          : "I saved this as product feedback for review."
    };
  }

  return {
    intent,
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    text: "I can help with CRM leads. Send client text, photos, PDFs, or ask about the selected lead."
  };
}

function isHelpMessage(content: string, intent: string): boolean {
  return intent === "support_request" && /(\/start|\/help|who are you|what can you do|кто ты|что умеешь)/i.test(content);
}

function createSharedCapabilityMessage(channel: "web" | "telegram"): string {
  const uploadHint =
    channel === "web"
      ? "In the web app, you can also attach files and photos here. On mobile, use your keyboard microphone for voice dictation."
      : "In Telegram, reply to a lead card to update that exact lead.";

  return [
    "Hi, I am Oleg's CRM assistant.",
    "I can create and update leads, read source materials, track missing KP fields, prepare KP documents, mark KP as sent, and explain what is waiting next.",
    uploadHint,
    "I only save feature requests when the message is clearly product feedback."
  ].join("\n\n");
}
```

- [ ] **Step 3: Export the engine**

Modify `packages/assistant/src/index.ts`:

```ts
export * from "./channel-engine";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @app/assistant test -- "channel-engine.test.ts" "classify-intent.test.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/channel-engine.ts packages/assistant/src/channel-engine.test.ts packages/assistant/src/index.ts
git commit -m "feat: add shared assistant channel engine"
```

---

### Task 4: Route Web Assistant Text Through the Shared Engine

**Files:**
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `packages/assistant/src/submission.ts`
- Modify: `packages/assistant/src/submission.test.ts`

- [ ] **Step 1: Add submission tests for non-feedback help**

Append to `packages/assistant/src/submission.test.ts`:

```ts
it("answers assistant identity questions without creating feedback", () => {
  const result = createAssistantSubmissionResult({
    context: { ...baseContext, route: "/leads", module: "leads" },
    content: "Кто ты и что умеешь?",
    threadId: "thread-help",
    messageId: "message-help"
  });

  expect(result.response).toContain("I can create and update leads");
  expect(result.feedback).toBeNull();
  expect(result.actionPreview).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails before wiring**

Run: `pnpm --filter @app/assistant test -- "submission.test.ts"`  
Expected before implementation: FAIL because current submission returns generic captured/support feedback behavior.

- [ ] **Step 3: Delegate non-action response text to the shared engine**

Modify `packages/assistant/src/submission.ts`:

```ts
import { createAssistantChannelResponse } from "./channel-engine";
```

Replace the final feedback block with:

```ts
  const channelResponse = createAssistantChannelResponse({
    channel: "web",
    threadId,
    messageId,
    content: trimmedContent,
    receivedAt: new Date().toISOString(),
    context,
    attachments: []
  });

  const feedback = channelResponse.shouldPersistFeedback
    ? createFeedbackItemFromMessage({
        workspaceId: context.workspaceId,
        sourceThreadId: threadId,
        sourceMessageId: messageId,
        intent: channelResponse.feedbackType ?? message.intent,
        moduleContext: context.module,
        role: context.role
      })
    : null;

  return {
    thread,
    message,
    response: channelResponse.text,
    feedback,
    actionPreview: null,
    confirmationStatus: null,
    permissionBlocked: null
  };
```

- [ ] **Step 4: Run assistant submission tests**

Run: `pnpm --filter @app/assistant test -- "submission.test.ts" "channel-engine.test.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/submission.ts packages/assistant/src/submission.test.ts
git commit -m "feat: route web assistant text through shared engine"
```

---

### Task 5: Add Web Assistant Attachments UI and Input Normalization

**Files:**
- Create: `apps/web/app/(app)/assistant/upload-source-material.ts`
- Modify: `apps/web/components/assistant-drawer.tsx`
- Test: `apps/web/app/(app)/assistant/upload-source-material.test.ts`

- [ ] **Step 1: Add tests for file kind normalization**

Create `apps/web/app/(app)/assistant/upload-source-material.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAssistantUploadKind } from "./upload-source-material";

describe("assistant upload source material", () => {
  it("detects photo, pdf, docx, and other upload kinds", () => {
    expect(getAssistantUploadKind("image/jpeg", "photo.jpg")).toBe("photo");
    expect(getAssistantUploadKind("application/pdf", "brief.pdf")).toBe("pdf");
    expect(getAssistantUploadKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "kp.docx")).toBe("docx");
    expect(getAssistantUploadKind("text/plain", "notes.txt")).toBe("text");
    expect(getAssistantUploadKind("application/octet-stream", "archive.bin")).toBe("other");
  });
});
```

- [ ] **Step 2: Implement upload helper**

Create `apps/web/app/(app)/assistant/upload-source-material.ts`:

```ts
import type { AssistantChannelAttachment } from "@app/assistant";

export function getAssistantUploadKind(mimeType: string, fileName: string): AssistantChannelAttachment["kind"] {
  const lowerName = fileName.toLowerCase();

  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType.startsWith("text/") || lowerName.endsWith(".txt")) return "text";

  return "other";
}

export async function createAssistantAttachmentFromFile(file: File): Promise<AssistantChannelAttachment> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return {
    id: `${Date.now()}-${file.name}`,
    kind: getAssistantUploadKind(file.type, file.name),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64: btoa(binary)
  };
}
```

- [ ] **Step 3: Add UI state and file input to drawer**

Modify `apps/web/components/assistant-drawer.tsx`:

```ts
import { Paperclip, Mic } from "lucide-react";
import { createAssistantAttachmentFromFile } from "@/app/(app)/assistant/upload-source-material";
import type { AssistantChannelAttachment } from "@app/assistant";
```

Add state:

```ts
const [attachments, setAttachments] = useState<AssistantChannelAttachment[]>([]);
```

Add file handler:

```ts
async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(event.target.files ?? []);
  const nextAttachments = await Promise.all(files.map(createAssistantAttachmentFromFile));
  setAttachments((current) => [...current, ...nextAttachments]);
  event.target.value = "";
}
```

Pass `attachments` in submit payload and clear after success:

```ts
const response = await submitAction({
  context,
  content: text,
  threadId,
  messageId,
  attachments
});

setAttachments([]);
```

Add compact controls above the Send button:

```tsx
<div className="mt-2 flex items-center justify-between gap-2">
  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold">
    <Paperclip aria-hidden="true" className="h-4 w-4" />
    Attach
    <input type="file" multiple accept="image/*,.pdf,.docx,.txt" onChange={handleFilesSelected} className="sr-only" />
  </label>
  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
    <Mic aria-hidden="true" className="h-4 w-4" />
    On mobile, use keyboard dictation.
  </span>
</div>
{attachments.length > 0 ? (
  <div className="mt-2 flex flex-wrap gap-2">
    {attachments.map((attachment) => (
      <span key={attachment.id} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        {attachment.fileName}
      </span>
    ))}
  </div>
) : null}
```

Update textarea placeholder:

```tsx
placeholder={
  history.length === 0
    ? "Send text, attach photos/PDFs, or answer onboarding. On mobile, use keyboard dictation."
    : "Ask about leads or add source material. On mobile, use keyboard dictation."
}
```

- [ ] **Step 4: Run web tests and typecheck**

Run: `pnpm --filter @app/web test -- "upload-source-material.test.ts"`  
Expected: PASS.

Run: `pnpm --filter @app/web typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(app)/assistant/upload-source-material.ts apps/web/app/(app)/assistant/upload-source-material.test.ts apps/web/components/assistant-drawer.tsx
git commit -m "feat: add web assistant source material uploads"
```

---

### Task 6: Extend Web Assistant Action Payloads With Attachments

**Files:**
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `packages/assistant/src/submission.ts`
- Modify: `packages/assistant/src/submission.test.ts`

- [ ] **Step 1: Extend input types**

Modify `packages/assistant/src/submission.ts`:

```ts
import type { AssistantChannelAttachment } from "./channel-message";

export type AssistantSubmissionInput = {
  context: AssistantContext;
  content: string;
  threadId: string;
  messageId: string;
  attachments?: AssistantChannelAttachment[];
};
```

Use attachments in the shared engine call:

```ts
attachments: attachments ?? []
```

- [ ] **Step 2: Extend web server action types**

Modify `apps/web/app/(app)/assistant/actions.ts`:

```ts
import type { AssistantChannelAttachment } from "@app/assistant";

export type SubmitAssistantMessageInput = {
  context: AssistantContext;
  content: string;
  threadId: string;
  messageId: string;
  attachments?: AssistantChannelAttachment[];
};
```

Pass attachments into `createOpenAIAssistantSubmissionResult` or `createAssistantSubmissionResult`, depending on the function already selected in this file:

```ts
const result = createAssistantSubmissionResult({
  context,
  content: input.content,
  threadId: input.threadId,
  messageId: input.messageId,
  attachments: input.attachments ?? []
});
```

- [ ] **Step 3: Test that uploads do not become feature requests**

Append to `packages/assistant/src/submission.test.ts`:

```ts
it("keeps source-material uploads in assistant context without creating feature feedback", () => {
  const result = createAssistantSubmissionResult({
    context: { ...baseContext, route: "/leads", module: "leads" },
    content: "Проверь этот план и создай лид, если данных хватает",
    threadId: "thread-upload",
    messageId: "message-upload",
    attachments: [
      {
        id: "attachment-1",
        kind: "photo",
        fileName: "site.jpg",
        mimeType: "image/jpeg",
        base64: "abcd"
      }
    ]
  });

  expect(result.feedback).toBeNull();
});
```

- [ ] **Step 4: Run assistant and web checks**

Run: `pnpm --filter @app/assistant test -- "submission.test.ts"`  
Expected: PASS.

Run: `pnpm --filter @app/web typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/submission.ts packages/assistant/src/submission.test.ts apps/web/app/(app)/assistant/actions.ts
git commit -m "feat: pass web assistant attachments through submission"
```

---

### Task 7: Keep Telegram Help Text and Web Help Text Aligned

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] **Step 1: Add Telegram parity tests**

Append to `packages/integrations/src/telegram/telegram-worker.test.ts` near existing `/start` or help tests:

```ts
it("uses the shared assistant capability text for Telegram help", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 101 } }) }));

  await processTelegramUpdates(
    [
      {
        update_id: 1,
        message: {
          message_id: 5,
          date: 1,
          chat: { id: 12345 },
          text: "/help"
        }
      }
    ],
    {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      parser: createStaticParser(),
      fetchImpl: fetchMock as unknown as typeof fetch
    }
  );

  const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
  expect(body.text).toContain("I can create and update leads");
});
```

- [ ] **Step 2: Import shared engine in Telegram worker**

Modify `packages/integrations/src/telegram/telegram-worker.ts`:

```ts
import { createAssistantChannelResponse } from "@app/assistant";
```

Replace `createTelegramWelcomeMessage()` and `createTelegramHelpMessage()` bodies with calls that create a normalized message:

```ts
function createTelegramHelpMessage(): string {
  return createAssistantChannelResponse({
    channel: "telegram",
    threadId: "telegram-help",
    messageId: "telegram-help",
    content: "/help",
    receivedAt: new Date().toISOString(),
    context: {
      workspaceId: "workspace-demo",
      userId: "telegram",
      role: "operator",
      module: "leads"
    },
    attachments: []
  }).text;
}
```

If `workspaceId` must be exact in help text, refactor `createTelegramHelpMessage(workspaceId: string, chatId: string)` and pass `config.workspaceId` and `message.chatId` at call sites.

- [ ] **Step 3: Run Telegram tests**

Run: `pnpm --filter @app/integrations test -- "telegram-worker.test.ts"`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts
git commit -m "feat: align telegram help with shared assistant engine"
```

---

### Task 8: Wire Web Lead Intake to the Shared Lead Parser Without Breaking Telegram

**Files:**
- Create: `packages/assistant/src/lead-channel-intake.ts`
- Create: `packages/assistant/src/lead-channel-intake.test.ts`
- Modify: `packages/integrations/src/telegram/openai-lead-parser.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`

- [ ] **Step 1: Extract parser-neutral intake input**

Create `packages/assistant/src/lead-channel-intake.ts`:

```ts
import { createLeadIntakeDraft, type LeadIntakeDraft } from "@app/core";
import type { AssistantChannelAttachment, AssistantChannelMessage } from "./channel-message";

export type ParsedAssistantLeadInput = {
  clientName: string;
  requestType: string;
  urgency: "low" | "medium" | "high" | "urgent";
  temperature: "cold" | "warm" | "hot" | "unknown";
  bgfM2?: number;
  projectAddress?: string;
  email?: string | null;
  phone?: string | null;
  missingData: string[];
  summary: string;
  suggestedReply: string;
};

export type AssistantLeadParserClient = {
  parseLead(input: { text: string; receivedAt: string; attachments?: AssistantChannelAttachment[] }): Promise<ParsedAssistantLeadInput>;
};

export type AssistantLeadIntakeDraft = Omit<LeadIntakeDraft, "missingData"> & {
  missingData: string[];
  temperature: ParsedAssistantLeadInput["temperature"];
  channelSourceExternalIds: string[];
};

export async function createLeadDraftFromAssistantChannelMessage(
  message: AssistantChannelMessage,
  parser: AssistantLeadParserClient
): Promise<AssistantLeadIntakeDraft> {
  const parsed = await parser.parseLead({
    text: message.content,
    receivedAt: message.receivedAt,
    attachments: message.attachments
  });
  const sourceExternalIds = [`${message.channel}:${message.threadId}:${message.messageId}`];

  const rawInput = [
    message.content,
    `${message.channel} sources: ${sourceExternalIds.join(", ")}`,
    createChannelAttachmentSummary(message.attachments),
    `Summary: ${parsed.summary}`,
    `Suggested reply: ${parsed.suggestedReply}`
  ]
    .filter(Boolean)
    .join("\n");

  const draft = createLeadIntakeDraft({
    source: message.channel,
    clientName: parsed.clientName,
    email: parsed.email,
    phone: parsed.phone,
    requestType: parsed.requestType,
    projectAddress: parsed.projectAddress,
    bgfM2: parsed.bgfM2,
    rawInput
  });

  return {
    ...draft,
    missingData: Array.from(new Set([...draft.missingData, ...parsed.missingData])),
    temperature: parsed.temperature,
    channelSourceExternalIds: sourceExternalIds
  };
}

function createChannelAttachmentSummary(attachments: AssistantChannelAttachment[]): string {
  return attachments
    .map((attachment, index) => `Attachment ${index + 1}: ${attachment.kind} (${attachment.fileName})`)
    .join("\n");
}
```

- [ ] **Step 2: Add parser-neutral tests**

Create `packages/assistant/src/lead-channel-intake.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLeadDraftFromAssistantChannelMessage } from "./lead-channel-intake";

describe("lead channel intake", () => {
  it("creates the same lead draft shape for web source material", async () => {
    const draft = await createLeadDraftFromAssistantChannelMessage(
      {
        channel: "web",
        threadId: "thread-1",
        messageId: "message-1",
        content: "Ирина, дом в Bad Aibling, BGF 195 м2, нужен Neubau EFH",
        receivedAt: "2026-05-26T08:00:00.000Z",
        context: { workspaceId: "workspace-demo", userId: "user-demo", role: "admin" },
        attachments: [{ id: "a1", kind: "photo", fileName: "house.jpg", mimeType: "image/jpeg", base64: "abcd" }]
      },
      {
        async parseLead() {
          return {
            clientName: "Ирина",
            requestType: "Neubau EFH",
            urgency: "medium",
            temperature: "warm",
            bgfM2: 195,
            projectAddress: "Bad Aibling",
            email: null,
            phone: null,
            missingData: ["email"],
            summary: "New EFH lead",
            suggestedReply: "Please send email."
          };
        }
      }
    );

    expect(draft.source).toBe("web");
    expect(draft.bgfM2).toBe(195);
    expect(draft.missingData).toContain("email");
    expect(draft.rawInput).toContain("Attachment 1: photo");
  });
});
```

- [ ] **Step 3: Run assistant intake tests**

Run: `pnpm --filter @app/assistant test -- "lead-channel-intake.test.ts"`  
Expected: PASS.

- [ ] **Step 4: Leave Telegram parser API intact**

Do not remove `createLeadDraftFromTelegramMessage` in this task. Add a comment above it:

```ts
// Telegram keeps this adapter while web lead intake migrates to the shared channel intake.
// The output shape must remain compatible with existing Telegram worker tests.
```

- [ ] **Step 5: Run Telegram regression**

Run: `pnpm --filter @app/integrations test -- "openai-lead-parser.test.ts" "telegram-worker.test.ts"`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/assistant/src/lead-channel-intake.ts packages/assistant/src/lead-channel-intake.test.ts packages/integrations/src/telegram/openai-lead-parser.ts
git commit -m "feat: add shared lead intake draft for assistant channels"
```

---

### Task 9: Add Web Assistant Lead Creation Preview From Source Material

**Files:**
- Modify: `packages/assistant/src/channel-engine.ts`
- Modify: `packages/assistant/src/channel-engine.test.ts`
- Modify: `apps/web/app/(app)/assistant/actions.ts`

- [ ] **Step 1: Add web lead-intake response tests**

Append to `packages/assistant/src/channel-engine.test.ts`:

```ts
it("treats web source material with attachments as lead intake, not product feedback", () => {
  const result = createAssistantChannelResponse({
    ...baseMessage,
    channel: "web",
    content: "Вот заявка клиента, создай лид если данных хватает",
    attachments: [{ id: "photo-1", kind: "photo", fileName: "brief.jpg", mimeType: "image/jpeg", base64: "abcd" }]
  });

  expect(result.intent).toBe("lead_intake");
  expect(result.shouldPersistFeedback).toBe(false);
  expect(result.text).toContain("I can create a lead from this source material");
});
```

- [ ] **Step 2: Implement lead-intake intent gate**

Modify `packages/assistant/src/channel-engine.ts` before feedback handling:

```ts
  if (isLeadSourceMaterial(message)) {
    return {
      intent: "lead_intake",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [{ label: "Create lead", action: "confirm" }],
      text: "I can create a lead from this source material. I will extract client, request, address, BGF, contacts, missing KP fields, and source references before saving."
    };
  }
```

Add helper:

```ts
function isLeadSourceMaterial(message: AssistantChannelMessage): boolean {
  if (message.attachments.length > 0) return true;
  return /(заявка|лид|client|lead|commercial proposal|коммерческое предложение|bgf|address|адрес|площадь)/i.test(message.content);
}
```

- [ ] **Step 3: Keep action execution review-first**

In `apps/web/app/(app)/assistant/actions.ts`, do not directly create leads in this task. Ensure the response remains a preview/action candidate until the existing confirmation path is extended in a later task.

- [ ] **Step 4: Run checks**

Run: `pnpm --filter @app/assistant test -- "channel-engine.test.ts"`  
Expected: PASS.

Run: `pnpm --filter @app/web typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/assistant/src/channel-engine.ts packages/assistant/src/channel-engine.test.ts apps/web/app/(app)/assistant/actions.ts
git commit -m "feat: recognize web assistant lead source material"
```

---

### Task 10: Verification Pass and Manual QA

**Files:**
- Modify: `docs/VERSIONING.md`
- Modify: `package.json` only if this feature is being released immediately

- [ ] **Step 1: Run package regression**

Run:

```bash
pnpm --filter @app/assistant test
pnpm --filter @app/integrations test -- "telegram-worker.test.ts" "openai-lead-parser.test.ts" "telegram-lead-draft-session.test.ts"
pnpm --filter @app/web typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 2: Manual web QA**

Run local app on the reserved CRM port:

```bash
pnpm --filter @app/web dev -- --hostname 0.0.0.0 --port 3002
```

Open:

```text
http://127.0.0.1:3002/leads
http://192.168.178.23:3002/leads
```

Check:
- Assistant says what it can do when asked `Кто ты и что умеешь?`.
- The response is not saved as feature request.
- Assistant placeholder mentions mobile dictation.
- File input accepts a JPG/PDF and shows the file chip.
- Sending text with an attached source material returns a lead-intake style response, not feature feedback.
- Existing lead card UI still scrolls above Assistant/Onboarding.

- [ ] **Step 3: Manual Telegram QA**

Run Telegram worker in test mode or staging:

```bash
pnpm worker:telegram
```

Check:
- `/start` and `/help` return the shared capability message.
- A normal client lead still creates or updates a lead.
- Replying to a bot lead card still updates that exact lead.
- PDF/DOC/CRM Telegram buttons remain unchanged except shared wording.

- [ ] **Step 4: Version bump only when ready to release**

If this is the release branch, bump from the current version to the next patch version in:
- `package.json`
- `docs/VERSIONING.md`
- tests that assert `currentAppMetadata.version`

Use the same version number in all files.

- [ ] **Step 5: Commit release verification**

```bash
git add package.json docs/VERSIONING.md packages/**/src/*.test.ts apps/web/**/*.tsx apps/web/**/*.ts
git commit -m "chore: verify unified assistant channel release"
```

---

## Self-Review

- Spec coverage: The plan covers shared assistant core, Telegram/Web parity, web attachments, voice input guidance, conservative feature-request capture, and preserving specialized channel behavior.
- Placeholder scan: The plan contains no `TBD`, `TODO`, or unspecified implementation steps.
- Type consistency: Shared types are introduced in Task 1 and reused by channel engine, web actions, upload helper, and lead intake tasks.
- Risk control: Telegram behavior remains guarded by existing `telegram-worker.test.ts` and is not rewritten until shared help and parser-neutral intake are covered by tests.
