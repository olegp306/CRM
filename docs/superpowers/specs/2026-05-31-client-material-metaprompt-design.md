# Client Material Metaprompt Design

## Goal

Create a workspace-configurable AI analysis layer for mixed client source materials. The layer should accept scattered text, PDFs, photos, DOCX/text files, and audio transcripts, then return structured lead data, missing KP fields, one lead summary, and one short summary per source document.

## Settings

The setting is stored per workspace, not globally. A new workspace AI setting role named `client_material_analysis` stores:

- the editable metaprompt;
- the selected OpenAI model;
- timestamps for audit/debugging.

The Settings UI adds a compact `AI intake` page linked from Settings. The page lets an admin edit the prompt and select a model from a small allowlist. The first version uses these options:

- `gpt-4.1` for stronger extraction;
- `gpt-4.1-mini` for cheaper/faster extraction;
- `gpt-4o` as a compatibility option for multimodal inputs already used by the project.

If no database setting exists, the app uses a built-in default prompt and model so Telegram and Web intake keep working.

## Analyzer Contract

The shared analyzer lives in `packages/assistant` and exposes a single interface:

```ts
type ClientMaterialAnalyzer = {
  analyze(input: ClientMaterialAnalysisInput): Promise<ClientMaterialAnalysisResult>;
};
```

Input includes channel, received timestamp, author if known, raw text, attachments, and transcripts already produced by audio intake.

Output is strict JSON with the field names the CRM already uses:

- `clientName`
- `requestType`
- `urgency`
- `temperature`
- `bgfM2`
- `projectAddress`
- `email`
- `phone`
- `budgetEur`
- `desiredStart`
- `desiredMoveIn`
- `isStandard`
- `missingData`
- `leadSummary`
- `documentSummaries`
- `suggestedReply`
- `confidence`

`documentSummaries` contains one entry per source material with `fileName`, `kind`, `summary`, optional `transcript`, and optional `storageKey` or `sourceUrl`.

## Intake Integration

The first implementation slice plugs the analyzer into the existing lead draft flow without changing how leads are stored. `lead-channel-intake` maps analyzer output into the current `LeadIntakeDraft`, and stores the lead summary plus document summaries in `rawInput` so the existing lead card summary/history UI can continue reading source context.

Telegram keeps its current adapter shape, but the OpenAI parser prompt is replaced with the same analyzer contract. This avoids a big rewrite while moving both channels toward one source of truth.

## Error Handling

If the AI call fails, returns invalid JSON, or cannot extract enough confidence, the app keeps the source material and returns a review-first draft with missing fields. The bot/assistant should say what is missing instead of silently dropping the material.

## Testing

Tests cover:

- default workspace AI setting values;
- saving and reading workspace AI settings;
- analyzer JSON schema parsing and null normalization;
- prompt/model passed into the OpenAI request;
- lead draft raw input includes lead summary and per-document summaries;
- legacy parser callers remain compatible.
