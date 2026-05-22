# Loop 1 Telegram Scenario Audit

Last updated: 2026-05-22

This audit maps the intended Loop 1 Telegram workflow to the current implementation and automated tests.

## Scenario Matrix

| Step | Intended behavior | Mode | Current status | Evidence | Gap / next action |
| --- | --- | --- | --- | --- | --- |
| 1 | User sends raw material to Telegram bot: text, documents, photos, or several related messages. | Manual | Implemented | `createAllowedTelegramMessages`, `createAllowedTelegramMessageBatches`, attachment hydration in `packages/integrations/src/telegram/telegram-worker.ts`; tests in `telegram-worker.test.ts` for grouped messages, PDF intake, photos/PDF parsing. | Needs real Telegram smoke test with production bot credentials before external demo. |
| 2 | AI extracts name, client type, area, location, urgency, and source. | Automatic | Partially implemented | `openai-lead-parser.ts` extracts `clientName`, `requestType`, `urgency`, `temperature`, `bgfM2`, `projectAddress`, `email`, `phone`, missing data, summary, reply. Source is stored through `Telegram sources: ...`. | `clientType` is not extracted explicitly; language/source-channel metadata is only implicit in raw input. |
| 3 | Bot asks clarifying questions when data is missing. | Automatic | Implemented for KP-required fields | Draft sessions use `getKpRequiredFieldStatus`; worker sends `Lead draft`, detected fields, ready fields, and missing fields. Tests cover incomplete PDF draft and follow-up enrichment. | Questions are generic missing-field prompts, not yet fully conversational field-by-field questions. |
| 4 | Create Client if new, then create Lead. | Automatic | Lead implemented; Client not fully implemented in Telegram path | Worker creates `lead` with parsed fields. Web/manual path and core helpers have client validation/matching. | Telegram worker does not create or link a `Client` record yet (`clientRecordId` remains unset). This is a real gap. |
| 5 | Decide standard vs non-standard. Standard: choose price from table and generate KP draft. Non-standard: outside 100-250m2, renovation/other special case -> manual pricing marker. | Automatic branch | Partially implemented | `classifyLeadStandardness` uses price table range and request type; Telegram draft carries `isStandard`; KP document generation is invoked when fields are ready. Tests cover standard/out-of-range/unsupported classifier and KP generation. | Telegram worker currently generates KP whenever KP-required fields are ready and `generateKpDocument` is available; it does not block non-standard leads into `needs_pricing`/manual review before KP generation. Price row chosen is not surfaced in lead/KP metadata. |
| 6 | User reviews, corrects, and manually sends KP to client through any channel. | Manual | Partially supported | Bot sends generated KP document to Telegram if `docxDeliveryUrl` exists; web lead editor allows correction; CRM link opens exact lead. | There is no explicit "review before send" state in Telegram; bot may deliver KP file to the operator, but does not model external client send channel. |
| 7 | User tells bot "KP sent". | Manual | Implemented in assistant/web action path; not clearly wired in Telegram command path | `mark_kp_sent` action exists in assistant, `createKpSentLeadUpdate` sets sent status and follow-up date. Tests cover assistant action execution. | Telegram worker does not yet parse a Telegram "KP sent" reply/command and update the lead directly. |
| 8 | Bot schedules follow-up in 7 days and marks it in CRM/calendar. | Automatic | Implemented in CRM lead fields; calendar not implemented | `createKpSentLeadUpdate` sets `kpSentDate`, `followup1Date = +7 days`, `followupStatus = planned`. Tests cover this. | No external calendar integration yet. Telegram command path from step 7 is missing, so this runs through assistant/web execution, not direct Telegram. |
| 9 | On due date, bot reminds with context and drafts a follow-up message in the right client language. | Automatic | Partially implemented | Due follow-ups and Today view exist (`getDueFollowups`, `today-store`). | Telegram due-date reminder loop and language-aware follow-up draft are not implemented yet. Client language exists on Client records, but the Telegram L01 path does not create/link Client language. |

## Automated Coverage

Current useful test files:

- `packages/integrations/src/telegram/telegram-worker.test.ts`
  - allowed Telegram message -> CRM lead
  - grouped Telegram messages -> one lead
  - `/newlead` starts draft
  - incomplete PDF -> draft, no lead
  - follow-up message enriches draft and creates lead
  - reply to bot draft message updates that draft
  - KP document generation and Telegram delivery
  - capability/help message does not create lead
  - duplicate Telegram source skip
- `packages/integrations/src/telegram/openai-lead-parser.test.ts`
  - parser maps AI output to CRM draft
  - image/PDF attachments are sent to OpenAI Responses as multimodal input
- `packages/core/src/leads/standard-classifier.test.ts`
  - standard price-table match
  - missing BGF/manual pricing
  - out-of-range and unsupported request type/manual pricing
- `packages/core/src/lead-intake/kp-sent-action.test.ts`
  - KP sent creates +7 day follow-up fields
- `apps/web/app/(app)/leads/l01-lead-intake-loop.test.ts`
  - deterministic assistant/web L01 path: lead creation, KP generation, KP sent marking, follow-up visibility

## Recommended Next Test Slices

1. Add Telegram worker test: non-standard lead (`renovation`, BGF outside standard range, or unsupported request) must not auto-generate KP and should set `needs_pricing` or explicit manual marker.
2. Add Telegram worker test: "KP sent" reply/button/command updates the lead and schedules `followup1Date` +7 days.
3. Add Telegram due-follow-up test: due follow-up produces a Telegram reminder with lead context.
4. Add language-aware draft test: follow-up draft language comes from linked Client language or inferred lead/client text.
5. Add Telegram client-linking test: new Telegram lead creates or links a Client and stores `clientRecordId`.

## Current Assessment

The implementation supports the front half of Loop 1 well: raw Telegram intake, AI parsing, draft clarification, lead creation, CRM deep link, and KP document generation. The back half is only partly closed: manual KP sent marking and follow-up scheduling exist in the assistant/web action path, but not as a direct Telegram command loop; calendar sync and due-date Telegram reminders are not implemented.

The biggest business risk before external testing is Step 5: non-standard leads should be blocked for manual pricing, but the Telegram worker can currently generate KP for any KP-ready draft when the document-generation port is available.
