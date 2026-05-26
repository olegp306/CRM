# Telegram Audio Voice Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Telegram lead intake accept voice/audio messages, transcribe them, preserve the full transcript and concise summary in lead source material, and combine audio with nearby photos/PDF/text into the existing lead/KP workflow.

**Architecture:** Treat Telegram audio as another source attachment in the existing Telegram batching pipeline. The Telegram adapter detects `voice` and `audio`, downloads the file, calls an injected `transcribeAudio` port, appends the transcript and author metadata to the text sent to the lead parser, then keeps the existing draft/lead/KP behavior. Ambiguous non-lead audio should remain conservative: answer with a clarification rather than creating a lead.

**Tech Stack:** TypeScript, Vitest, Telegram Bot API `getFile`, OpenAI `/v1/audio/transcriptions` via multipart `FormData`, existing `packages/integrations` Telegram worker and parser.

---

## File Structure

- Modify `packages/integrations/src/telegram/telegram-polling.ts`
  - Add Telegram `voice`, `audio`, and `from` update fields.
  - Add `audio` pending attachment kind.
  - Include audio placeholder text so attachment-only voice messages enter batching.

- Modify `packages/integrations/src/telegram/openai-lead-parser.ts`
  - Add `audio` Telegram attachment kind metadata.
  - Include audio transcript and author metadata in raw input.
  - Keep parser input as text + non-audio visual/document attachments.

- Modify `packages/integrations/src/telegram/telegram-worker.ts`
  - Add `transcribeAudio` worker port.
  - Download audio bytes during hydration.
  - Transcribe audio before parsing.
  - Save full transcript, summary input, source id, and author line in raw input.
  - Use existing batch behavior for mixed audio/photo/PDF/text.

- Modify `packages/integrations/src/telegram/telegram-worker.test.ts`
  - Add tests for voice-only lead creation, mixed photo+voice batching, and ambiguous audio clarification.

- Create `packages/integrations/src/telegram/openai-audio-transcriber.ts`
  - Small OpenAI transcription adapter using `FormData`.

- Create `packages/integrations/src/telegram/openai-audio-transcriber.test.ts`
  - Verify request shape and response parsing.

---

## Task 1: Telegram Update Audio Contracts

**Files:**
- Modify `packages/integrations/src/telegram/telegram-polling.ts`
- Test `packages/integrations/src/telegram/telegram-polling.test.ts`

- [x] **Step 1: Write failing tests**

Add a test proving `createAllowedTelegramMessages` accepts voice/audio-only messages:

```ts
it("accepts allowed Telegram voice messages as source material", () => {
  expect(
    createAllowedTelegramMessages(
      [
        {
          update_id: 50,
          message: {
            message_id: 501,
            date: 1779299000,
            chat: { id: 12345 },
            from: { id: 7, first_name: "Oleg", username: "olegp" },
            voice: { file_id: "voice-file", mime_type: "audio/ogg", duration: 18 }
          }
        }
      ],
      new Set(["12345"])
    )
  ).toEqual([
    expect.objectContaining({
      text: "[Telegram audio attachment: voice-file]",
      authorName: "Oleg",
      authorUsername: "olegp",
      attachments: [expect.objectContaining({ kind: "audio", fileId: "voice-file", mimeType: "audio/ogg" })]
    })
  ]);
});
```

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-polling.test.ts
```

Expected: FAIL because `voice`, `audio`, and author metadata are not represented.

- [x] **Step 3: Implement minimal polling support**

Update `TelegramUpdate["message"]` with `from`, `voice`, and `audio`; update `AllowedTelegramMessage` with optional `authorName` and `authorUsername`; add audio pending attachments in `createTelegramPendingAttachments`; add placeholder rendering in `createTelegramLeadText`.

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-polling.test.ts
```

Expected: PASS.

---

## Task 2: OpenAI Audio Transcriber Adapter

**Files:**
- Create `packages/integrations/src/telegram/openai-audio-transcriber.ts`
- Create `packages/integrations/src/telegram/openai-audio-transcriber.test.ts`

- [x] **Step 1: Write failing adapter test**

Test that `createOpenAiAudioTranscriber({ apiKey, model, fetchImpl })` posts `FormData` to `https://api.openai.com/v1/audio/transcriptions` and returns `text`.

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm --filter @app/integrations test -- openai-audio-transcriber.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement minimal adapter**

Expose:

```ts
export type TelegramAudioTranscriber = {
  transcribe(input: { base64: string; mimeType: string; fileName: string; language?: string }): Promise<{ text: string }>;
};
```

Use `Blob`, `FormData`, `model`, and `file`. Default model will be wired from env as `OPENAI_AUDIO_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"`.

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm --filter @app/integrations test -- openai-audio-transcriber.test.ts
```

Expected: PASS.

---

## Task 3: Hydrate And Transcribe Telegram Audio

**Files:**
- Modify `packages/integrations/src/telegram/openai-lead-parser.ts`
- Modify `packages/integrations/src/telegram/telegram-worker.ts`
- Test `packages/integrations/src/telegram/telegram-worker.test.ts`

- [x] **Step 1: Write failing voice-only test**

Add a Telegram worker test with a `voice` message and injected `audioTranscriber`. Assert:

- worker downloads the audio with Telegram `getFile` + file URL;
- transcriber receives base64 audio;
- parser receives text containing `Audio transcript: ...`;
- created lead raw input contains full transcript, author line, Telegram source id, parser summary, and suggested reply.

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: FAIL because audio is not hydrated/transcribed.

- [x] **Step 3: Implement minimal worker hydration**

Add `audioTranscriber?: TelegramAudioTranscriber` to worker config. During `hydrateTelegramLeadMessage`, download audio attachments, transcribe them, and add `transcript` to attachment metadata. The final message text sent to the parser must include:

```text
Audio transcript 1 (voice.ogg):
<full transcript>

Author: <name or username when available>
```

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: PASS.

---

## Task 4: Mixed Audio + Image Batch

**Files:**
- Modify `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify `packages/integrations/src/telegram/telegram-worker.ts`

- [x] **Step 1: Write failing mixed batch test**

Add a test with two nearby updates from the same chat:

1. photo message;
2. voice message.

Assert one lead is created, parser sees both `[Telegram image attachment: ...]` and the audio transcript, and `rawInput` contains both source ids.

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: FAIL until audio transcript merges into the batched message.

- [x] **Step 3: Implement batch-safe attachment transcript merging**

Ensure `createAllowedTelegramMessageBatches` preserves audio attachments and `hydrateTelegramLeadMessage` processes all attachments in the merged batch.

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: PASS.

---

## Task 5: Conservative Clarification When Audio Is Ambiguous

**Files:**
- Modify `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify `packages/integrations/src/telegram/telegram-worker.ts`

- [x] **Step 1: Write failing ambiguity test**

Add a test where transcription returns casual text like `I am not sure what we should do with this`. The parser returns empty client/request/address and missing core fields. Assert worker does not create a lead and sends a clarification message asking whether to create a new lead, add to an existing lead, or save as feedback.

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: FAIL because current behavior likely creates a draft or generic response.

- [x] **Step 3: Implement confidence gate**

Add a small helper near Telegram draft creation:

```ts
function shouldAskClarifyingQuestionForAudio(draft, hydratedMessage): boolean
```

Return true when the message has audio, no existing replied lead, and parser produced no client/request/address plus missing core KP fields. Send a short Telegram clarification instead of creating a draft/lead.

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: PASS.

---

## Task 6: Env Wiring And Verification

**Files:**
- Modify `packages/integrations/src/telegram/telegram-worker.ts`
- Modify `docs/superpowers/plans/2026-05-26-telegram-audio-voice-intake.md`

- [x] **Step 1: Wire transcriber from env**

In `runTelegramWorkerFromEnv`, create the audio transcriber when `OPENAI_API_KEY` is present:

```ts
audioTranscriber: createOpenAiAudioTranscriber({
  apiKey,
  model: env.OPENAI_AUDIO_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"
})
```

- [x] **Step 2: Run package checks**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-polling.test.ts openai-audio-transcriber.test.ts telegram-worker.test.ts
pnpm --filter @app/integrations typecheck
```

Expected: PASS.

- [x] **Step 3: Commit and push**

```powershell
git add docs/superpowers/plans/2026-05-26-telegram-audio-voice-intake.md packages/integrations/src/telegram
git commit -m "feat: add telegram audio voice intake"
git push origin codex/telegram-audio-voice-intake
```

---

## Self-Review

Spec coverage:

- Voice/audio intake: Tasks 1-3.
- Mixed pictures plus audio: Task 4.
- Full transcript and concise summary: Task 3 stores transcript; existing parser summary remains in raw input.
- Author metadata when available: Tasks 1 and 3.
- KP workflow reuse: Tasks 3-4 reuse existing lead/KP path.
- Clarifying questions below confidence threshold: Task 5.
- Final robustness addendum: Telegram raw input now retains original audio `file_id` source metadata, transcription failures produce a user-facing resend/text-summary prompt instead of failing the worker, and shared Telegram help explicitly advertises voice messages.
- Final source-storage addendum: downloaded Telegram photos/PDF/audio can now be saved as `Attachment` rows with object storage keys via the worker's `saveSourceAttachment` port; env wiring uses the existing `Attachment` model and configured object storage, and raw input records the saved attachment id.

Placeholder scan:

- No `TBD`, no `TODO`, no unspecified implementation steps.

Type consistency:

- `audioTranscriber`, `TelegramAudioTranscriber`, `TelegramLeadAttachment.kind = "audio"`, and author fields are introduced before later tasks reference them.
