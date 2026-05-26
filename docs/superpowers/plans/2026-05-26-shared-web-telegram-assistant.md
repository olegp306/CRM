# Shared Web Telegram Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Web Assistant and Telegram use the same CRM assistant scenario engine, so they feel like two entry channels for one assistant rather than two separately implemented bots.

**Architecture:** Keep Telegram and Web as thin channel adapters. Move intent routing, lead draft state decisions, missing KP field decisions, KP-ready actions, and channel-neutral response contracts into `packages/assistant`. Channel adapters only hydrate files, persist/update data, render buttons/messages, and execute channel-specific delivery.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Next.js server actions, Telegram worker, existing assistant/core/db packages.

---

## Current State

Already implemented on `codex/shared-chat-orchestrator`:

- `packages/assistant/src/lead-chat-orchestrator.ts` exists and owns the first shared lead-chat contract.
- `packages/assistant/src/capability-registry.ts` exists and handles theme/dark-mode capability questions.
- Web Assistant uses `createAssistantChannelResponse`.
- Telegram uses shared `/newlead`, `/help`, `/start`, and capability response routing.
- Telegram still owns most real lead-flow behavior in `packages/integrations/src/telegram/telegram-worker.ts`.

---

## Final Acceptance Criteria

- A user can start or continue a lead from Telegram or Web Assistant with equivalent assistant behavior.
- Replying to a Telegram lead card and selecting a lead in Web Assistant both map to the same `targetLeadId` scenario.
- Missing KP fields and KP-ready state are computed and messaged through the same shared lead flow.
- Web and Telegram expose the same normalized actions where possible: `open_crm`, `open_pdf`, `download_doc`, `send_kp`, `mark_kp_sent`, `undo_kp_sent`.
- Telegram-specific and Web-specific code only adapts transport, files, persistence ports, and message/button rendering.
- The phrase `а есть цветовая схема или тема темная для вечера ?` remains a capability response and never becomes lead intake.

---

## Approach 1: Shared Lead Draft Decision Engine

**Resulting product state:** Telegram and Web can both ask the same assistant package: “is this a new lead draft, update existing lead, different-client clarification, or ignore/support/capability message?”

**Files:**

- Create: `packages/assistant/src/lead-flow-decision.ts`
- Create: `packages/assistant/src/lead-flow-decision.test.ts`
- Modify: `packages/assistant/src/index.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

**Shared contract to create:**

```ts
export type LeadFlowDecision =
  | {
      kind: "start_draft";
      source: "new_lead_command" | "source_material";
    }
  | {
      kind: "update_existing_lead";
      leadId: string;
      source: "reply" | "selected_record" | "explicit_id";
    }
  | {
      kind: "possible_different_lead";
      leadId: string;
      reason: string;
    }
  | {
      kind: "not_lead_flow";
    };
```

- [x] Write failing tests in `packages/assistant/src/lead-flow-decision.test.ts`:
  - `/newlead` returns `start_draft`.
  - Web selected lead `L-2026-004` plus source material returns `update_existing_lead`.
  - Telegram `replyTo.leadId` plus new data returns `update_existing_lead`.
  - Theme capability text returns `not_lead_flow`.
  - Status/support question for selected lead returns `not_lead_flow`.

Run:

```powershell
pnpm --filter @app/assistant test -- lead-flow-decision.test.ts
```

Expected first run: FAIL because `lead-flow-decision.ts` does not exist.

- [x] Implement `decideLeadFlow(message, options)` in `packages/assistant/src/lead-flow-decision.ts`.

Core rules:

```ts
if (createCapabilityResponse(message)) return { kind: "not_lead_flow" };
if (isNewLeadCommand(message.content)) return { kind: "start_draft", source: "new_lead_command" };
if (message.replyTo?.leadId) return { kind: "update_existing_lead", leadId: message.replyTo.leadId, source: "reply" };
if (selectedLeadId && isLeadChatSourceMaterial(message)) return { kind: "update_existing_lead", leadId: selectedLeadId, source: "selected_record" };
if (explicitLeadId && isLeadChatSourceMaterial(message)) return { kind: "update_existing_lead", leadId: explicitLeadId, source: "explicit_id" };
if (isLeadChatSourceMaterial(message)) return { kind: "start_draft", source: "source_material" };
return { kind: "not_lead_flow" };
```

- [x] Export the new module from `packages/assistant/src/index.ts`.

- [x] In Telegram, replace only the early “should this message be general assistant vs lead flow?” branching with `decideLeadFlow`. Do not move persistence or parser code yet.

- [x] Add Telegram regression tests:
  - Theme question does not call parser.
  - Reply to known lead still updates that lead.
  - `/newlead` still starts draft.

Verification:

```powershell
pnpm --filter @app/assistant test -- lead-flow-decision.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/assistant typecheck
pnpm --filter @app/integrations typecheck
```

Commit:

```powershell
git add packages/assistant/src/lead-flow-decision.ts packages/assistant/src/lead-flow-decision.test.ts packages/assistant/src/index.ts packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts
git commit -m "feat: add shared lead flow decisions"
```

---

## Approach 2: Shared Lead Draft Merge And Missing Fields

**Resulting product state:** Telegram and Web use the same assistant package to merge incoming source material into an existing draft and compute KP missing/ready state.

**Files:**

- Create: `packages/assistant/src/lead-draft-flow.ts`
- Create: `packages/assistant/src/lead-draft-flow.test.ts`
- Modify: `packages/integrations/src/telegram/telegram-lead-draft-session.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify: `apps/web/app/(app)/assistant/lead-execution-store.ts`
- Modify: `apps/web/app/(app)/assistant/actions.ts`

**Shared contract to create:**

```ts
export type LeadDraftFlowState = {
  leadId?: string;
  clientName?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  bgfM2?: number | null;
  email?: string | null;
  phone?: string | null;
  rawInput: string;
  missingData: string[];
  sourceExternalIds: string[];
};

export type LeadDraftMergeResult = {
  draft: LeadDraftFlowState;
  missingData: string[];
  kpReady: boolean;
};
```

- [x] Write failing tests:
  - Existing draft missing `projectAddress` becomes ready when new parsed input includes `projectAddress`.
  - Missing data is deduplicated and ordered.
  - Template required fields override generic missing fields.
  - Source external ids append without duplicates.

Run:

```powershell
pnpm --filter @app/assistant test -- lead-draft-flow.test.ts
```

Expected first run: FAIL because file is missing.

- [x] Implement:
  - `mergeLeadDraftFlowState(existing, incoming, options)`
  - `getLeadDraftKpStatus(draft, requiredFields)`
  - `createLeadDraftRawInput(existingRawInput, incomingRawInput, sourceExternalIds)`

- [x] Refactor Telegram draft session helpers to call shared functions while preserving exported Telegram-specific APIs.

- [x] Verify the existing Web Assistant path can hold lead source material in action preview/memory without a schema migration. Full Web draft-session parity remains in Approach 4 with unified channel history.

Verification:

```powershell
pnpm --filter @app/assistant test -- lead-draft-flow.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/web test -- assistant-action-preview.test.ts assistant-route-context.test.ts
pnpm --filter @app/assistant typecheck
pnpm --filter @app/integrations typecheck
pnpm --filter @app/web typecheck
```

Commit:

```powershell
git add packages/assistant/src/lead-draft-flow.ts packages/assistant/src/lead-draft-flow.test.ts packages/integrations/src/telegram/telegram-lead-draft-session.ts packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts apps/web/app/(app)/assistant/lead-execution-store.ts apps/web/app/(app)/assistant/actions.ts
git commit -m "feat: share lead draft merge flow"
```

---

## Approach 3: Shared Lead Action Orchestrator

**Resulting product state:** Web and Telegram expose and execute the same lead actions from the same normalized action model.

**Files:**

- Create: `packages/assistant/src/lead-action-orchestrator.ts`
- Create: `packages/assistant/src/lead-action-orchestrator.test.ts`
- Modify: `packages/assistant/src/action-execution.ts`
- Modify: `packages/assistant/src/action-preview.ts`
- Modify: `apps/web/components/assistant-route-context.ts`
- Modify: `apps/web/components/assistant-drawer.tsx`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

**Shared contract to create:**

```ts
export type LeadChatAction =
  | { type: "open_crm"; leadId: string; url: string }
  | { type: "open_pdf"; leadId: string; url: string }
  | { type: "download_doc"; leadId: string; url: string }
  | { type: "send_kp"; leadId: string; mailtoUrl: string }
  | { type: "mark_kp_sent"; leadId: string }
  | { type: "undo_kp_sent"; leadId: string };
```

- [x] Write failing tests:
  - KP-ready lead returns CRM/PDF/DOC/Send KP/Mark KP sent.
  - KP-sent lead additionally returns Undo KP sent.
  - Lead missing required fields does not return Send KP as enabled.
  - Web buttons and Telegram inline keyboard are rendered from the same action list.

Run:

```powershell
pnpm --filter @app/assistant test -- lead-action-orchestrator.test.ts
```

Expected first run: FAIL because module does not exist.

- [x] Implement `createLeadChatActions(lead, options)` in assistant package.

- [x] Update Web Assistant button handling:
  - `open_crm`, `open_pdf`, `download_doc` are links.
  - `send_kp` is a `mailto:` link.
  - `mark_kp_sent` and `undo_kp_sent` continue to go through existing confirmation/action execution.

- [x] Update Telegram URL button rendering from normalized actions:
  - Labels exactly `CRM`, `PDF`, `DOC`, `Send KP`.
  - `Mark KP sent` and `Undo` remain supported by reply text commands until a callback-query slice adds non-URL Telegram buttons.
  - PDF opens delivery URL.
  - DOC downloads delivery URL.

Verification:

```powershell
pnpm --filter @app/assistant test -- lead-action-orchestrator.test.ts action-execution.test.ts
pnpm --filter @app/web test -- assistant-drawer.test.ts assistant-route-context.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/web typecheck
pnpm --filter @app/integrations typecheck
```

Commit:

```powershell
git add packages/assistant/src/lead-action-orchestrator.ts packages/assistant/src/lead-action-orchestrator.test.ts packages/assistant/src/action-execution.ts packages/assistant/src/action-preview.ts apps/web/components/assistant-route-context.ts apps/web/components/assistant-drawer.tsx packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts
git commit -m "feat: share lead chat actions"
```

---

## Approach 4: Unified Conversation And History Events

**Resulting product state:** Telegram and Web Assistant write comparable events into one assistant memory stream: message received, lead draft updated, lead created, KP generated, KP sent, undo performed.

**Files:**

- Create: `packages/assistant/src/channel-event.ts`
- Create: `packages/assistant/src/channel-event.test.ts`
- Modify: `packages/assistant/src/persistence.ts`
- Modify: `packages/assistant/src/audit-log.ts`
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `apps/web/app/(app)/leads/lead-table-store.ts`

**Shared contract to create:**

```ts
export type AssistantChannelEvent =
  | { type: "message_received"; channel: "web" | "telegram"; threadId: string; messageId: string; leadId?: string; summary: string }
  | { type: "lead_draft_updated"; channel: "web" | "telegram"; threadId: string; leadId?: string; fieldsChanged: string[]; missingData: string[] }
  | { type: "lead_created"; channel: "web" | "telegram"; threadId: string; leadId: string; fieldsCreated: string[]; missingData: string[] }
  | { type: "kp_generated"; channel: "web" | "telegram"; threadId: string; leadId: string; documentId: string }
  | { type: "kp_sent_marked"; channel: "web" | "telegram"; threadId: string; leadId: string }
  | { type: "kp_sent_undone"; channel: "web" | "telegram"; threadId: string; leadId: string };
```

- [x] Write failing tests:
  - Telegram lead creation emits `message_received`, `lead_created`, and `kp_generated` when document exists.
  - Web lead creation emits equivalent events.
  - Lead card history can render these events in chronological order.

Run:

```powershell
pnpm --filter @app/assistant test -- channel-event.test.ts
pnpm --filter @app/web test -- lead-table-store.test.ts
```

Expected first run: FAIL because event mapper is missing.

- [x] Implement event creation helpers:
  - `createMessageReceivedEvent`
  - `createLeadDraftUpdatedEvent`
  - `createLeadCreatedEvent`
  - `createKpGeneratedEvent`
  - `createKpSentMarkedEvent`
  - `createKpSentUndoneEvent`

- [x] Persist Web Assistant events through existing assistant repository/audit-log first. Avoid database schema migration in this approach unless the repository already requires it.

- [x] Add Telegram worker audit-event persistence through an injected assistant repository port.

- [x] Update lead card history rendering to include web and Telegram events with channel labels.

Verification:

```powershell
pnpm --filter @app/assistant test -- channel-event.test.ts persistence.test.ts audit-log.test.ts
pnpm --filter @app/web test -- lead-table-store.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/assistant typecheck
pnpm --filter @app/web typecheck
pnpm --filter @app/integrations typecheck
```

Commit:

```powershell
git add packages/assistant/src/channel-event.ts packages/assistant/src/channel-event.test.ts packages/assistant/src/persistence.ts packages/assistant/src/audit-log.ts apps/web/app/(app)/assistant/actions.ts packages/integrations/src/telegram/telegram-worker.ts apps/web/app/(app)/leads/lead-table-store.ts
git commit -m "feat: unify assistant channel history"
```

---

## Approach 5: End-To-End Parity Verification And Cleanup

**Resulting product state:** We can say the Web Assistant and Telegram are the same assistant channel architecture. Remaining differences are intentional channel adapters.

**Files:**

- Create: `packages/assistant/src/channel-parity.test.ts`
- Modify: `packages/assistant/src/channel-engine.ts`
- Modify: `packages/assistant/src/openai-provider.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `apps/web/components/assistant-drawer.tsx`
- Modify: `docs/VERSIONING.md`
- Modify: `package.json`

**Parity tests to create:**

```ts
describe("assistant channel parity", () => {
  it("returns equivalent lead intake intent for Telegram and Web source material", () => {});
  it("returns equivalent update intent for Telegram reply and Web selected lead", () => {});
  it("returns equivalent KP-ready actions for both channels", () => {});
  it("routes theme capability questions away from lead intake in both channels", () => {});
});
```

- [x] Write `channel-parity.test.ts` with paired Web/Telegram inputs and compare:
  - `intent`
  - normalized action types
  - feedback persistence
  - lead target id

- [x] Run it and verify it fails on any remaining channel-specific divergence.

Run:

```powershell
pnpm --filter @app/assistant test -- channel-parity.test.ts
```

- [x] Remove duplicated channel-specific decision logic that parity tests reveal:
  - Telegram should not independently decide feature/capability/support behavior except `/start` transport details.
  - Web onboarding should not intercept CRM/capability/lead-flow messages.

- [x] Update version:
  - Bump `package.json` from `0.1.7` to `0.2.0` for this feature release.
  - Update `docs/VERSIONING.md` with a note that shared Web/Telegram assistant channel architecture is included.

- [x] Run full verification:

```powershell
pnpm typecheck
pnpm test
pnpm --filter @app/web build
```

- [ ] Manually verify locally:
  - Web app restarted on `http://localhost:3002/leads` and returned HTTP 200 after the build.
  - Start web app.
  - Ask web assistant: `а есть цветовая схема или тема темная для вечера ?`.
  - Click `Nocturne`, confirm visual theme changes.
  - Ask web assistant to create/update a lead from source text.
  - In Telegram test mode, send equivalent source text.
  - Confirm both produce equivalent lead state/actions.

- [ ] Commit and push:

```powershell
git add package.json docs/VERSIONING.md packages/assistant/src/channel-parity.test.ts packages/assistant/src/channel-engine.ts packages/assistant/src/openai-provider.ts packages/integrations/src/telegram/telegram-worker.ts apps/web/components/assistant-drawer.tsx
git commit -m "feat: complete web telegram assistant parity"
git push origin codex/shared-chat-orchestrator
```

---

## Progress Forecast

Current completion: **40-45%**.

After Approach 1: **50-55%**.

After Approach 2: **70-75%**.

After Approach 3: **82-87%**.

After Approach 4: **92-95%**.

After Approach 5: **100% for this parity milestone**.

---

## Approach 6: Web Selected Lead Runtime Snapshot

**Resulting product state:** When the Web Assistant is opened from a lead card URL, it can answer about that exact lead with the same KP-ready action set as Telegram lead cards.

- [x] Add a pure selected-lead mapper from stored lead/document records into `LeadChatSnapshot`.
- [x] Pass the selected lead snapshot into deterministic assistant submission and OpenAI fallback paths.
- [x] Keep ordinary create-lead requests in the OpenAI planning path unless the shared engine returned real normalized actions.
- [x] Treat selected-lead `Mark KP sent` / `Undo` buttons as confirmation actions in the Web Assistant UI.

Verification:

```powershell
pnpm --filter @app/assistant test -- submission.test.ts openai-provider.test.ts lead-chat-orchestrator.test.ts channel-parity.test.ts
pnpm --filter @app/web test -- selected-lead-snapshot.test.ts assistant-route-context.test.ts
pnpm --filter @app/assistant typecheck
pnpm --filter @app/web typecheck
```

---

## Approach 7: Telegram Lead Action Callback Buttons

**Resulting product state:** Telegram lead cards expose the same primary lead actions as Web Assistant snapshots, including one-tap `Mark KP sent` and `Undo KP sent` actions.

- [x] Add Telegram `callback_query` support for lead action buttons.
- [x] Render `mark_kp_sent` and `undo_kp_sent` normalized actions as Telegram inline callback buttons.
- [x] Resolve callback actions back to the originating lead card, update the lead, answer Telegram callback queries, and save channel events.
- [x] Keep replied lead support questions in lead context so short questions like `What is the status?` do not fall back to generic chat.

Verification:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/integrations test -- telegram-polling.test.ts
pnpm --filter @app/assistant test -- channel-engine.test.ts lead-flow-decision.test.ts channel-parity.test.ts
pnpm --filter @app/integrations typecheck
pnpm --filter @app/assistant typecheck
```

---

## Approach 8: Web Assistant Source Material Parsing

**Resulting product state:** Web Assistant source-material uploads use the same parser-backed lead field extraction pattern as Telegram before the operator confirms lead creation.

- [x] Add an OpenAI lead parser adapter in `packages/assistant` for normalized channel attachments.
- [x] Enrich Web lead-intake action previews with parsed client, request, address, BGF, contact, missing-field, standard-pricing, and temperature fields.
- [x] Teach action execution to prefer parsed preview fields over raw text heuristics while preserving the raw source material.
- [x] Wire the Web Assistant server action to enrich source-material previews when `OPENAI_API_KEY` is available.

Verification:

```powershell
pnpm --filter @app/assistant test -- submission.test.ts action-execution.test.ts openai-lead-parser.test.ts lead-channel-intake.test.ts openai-provider.test.ts
pnpm --filter @app/web test -- upload-source-material.test.ts assistant-route-context.test.ts assistant-action-preview.test.ts
pnpm --filter @app/assistant typecheck
pnpm --filter @app/web typecheck
```

---

## Self-Review

Spec coverage:

- Shared orchestrator: Approaches 1-3.
- Web/Telegram same channel behavior: Approaches 1-5.
- Reply/selected lead equivalence: Approaches 1-2.
- Missing fields / KP ready: Approach 2.
- Normalized actions: Approach 3.
- Shared history: Approach 4.
- Final parity verification: Approach 5.

Placeholder scan:

- No `TBD`, no `TODO`, no unspecified “write tests” without named tests and commands.

Type consistency:

- `LeadFlowDecision`, `LeadDraftFlowState`, `LeadChatAction`, and `AssistantChannelEvent` are introduced before later tasks reference them.
