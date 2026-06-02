# CRM Entity Extractor Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable CRM Entity Extractor Agent after the CRM Orchestrator so Telegram and Web Assistant can turn human CRM messages into facts, events, follow-ups, people, organizations, tags, lead naming data, searchable lead context, and future calendar actions.

**Architecture:** Keep CRM Orchestrator as the first routing layer. Add `crm_entity_extractor` as a new workspace AI role and a focused extractor contract in `packages/assistant`; route `UPDATE_LEAD`, `CREATE_REMINDER`, and selected `CREATE_LEAD` post-processing through this extractor. Persist extracted entities and calendar actions in new Prisma models, while keeping existing lead creation/update behavior intact.

**Tech Stack:** TypeScript, Next.js App Router, Prisma/PostgreSQL, Vitest, OpenAI Responses API, existing Telegram worker, existing Web Assistant server actions, existing Settings AI prompt pattern.

---

## Scope

This plan covers the complete feature set requested:

- CRM Orchestrator remains the top-level agent for Telegram and Web Assistant.
- A configurable CRM Entity Extractor Agent exists in Settings with editable metaprompt and model selection.
- Settings visually show a hierarchy: Orchestrator first, specialized agents below.
- Extractor finds `FACT`, `EVENT`, `FOLLOW_UP`, `PERSON`, `ORGANIZATION`, and `TAG`.
- Extractor can support future native search through normalized tags and searchable lead context.
- New leads get a readable `displayName` based on customer name plus place/object/site, preserving the local language of the recognized project location.
- Extracted facts and notes are written into lead history/context.
- Follow-ups and events are persisted as durable calendar actions and shown as future action history.
- Telegram and Web Assistant both use the same extractor contract after orchestration.
- The first production behavior focuses on leads; clients can be added later using the same entity tables.

## File Structure

- `packages/db/prisma/schema.prisma`
  Adds durable entity extraction and calendar action models plus lead display/search fields.
- `packages/db/prisma/migrations/<timestamp>_crm_entity_extractor/`
  Adds SQL migration for new models and indexes.
- `packages/db/src/workspace-ai-setting-prisma-store.ts`
  Adds `crm_entity_extractor` role, default prompt/model, store methods, tests.
- `apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts`
  Adds memory runtime support and model options for entity extractor.
- `apps/web/app/(app)/settings/crm-entity-extractor/page.tsx`
  New Settings page for prompt/model.
- `apps/web/app/(app)/settings/crm-entity-extractor/actions.ts`
  Server action for saving extractor settings.
- `apps/web/app/(app)/settings/page.tsx`
  Refactors settings cards to show Orchestrator on top and specialized agents below.
- `packages/assistant/src/crm-entity-extractor.ts`
  Pure types, default prompt, normalization, deterministic fallback parser.
- `packages/assistant/src/openai-crm-entity-extractor.ts`
  OpenAI Responses API adapter with JSON schema.
- `packages/assistant/src/lead-display-name.ts`
  Lead display name, locale/country hints, search tags.
- `packages/assistant/src/crm-entity-router.ts`
  Maps extracted entities to lead history updates and calendar action drafts.
- `packages/assistant/src/index.ts`
  Exports new modules.
- `packages/db/src/crm-entity-prisma-store.ts`
  Persists extracted entities and calendar actions.
- `packages/db/src/assistant-lead-prisma-store.ts`
  Persists lead display/search fields during lead creation/update.
- `packages/integrations/src/telegram/telegram-worker.ts`
  Wires extractor after orchestrator and after lead draft creation/update.
- `apps/web/app/(app)/assistant/actions.ts`
  Wires extractor for Web Assistant selected-lead notes/reminders/source updates.
- `apps/web/app/(app)/today/today-store.ts`
  Reads persisted calendar actions instead of only memory follow-ups.
- Tests beside each touched file.

---

## Task 1: Workspace AI Role and Settings Store

**Files:**
- Modify: `packages/db/src/workspace-ai-setting-prisma-store.ts`
- Modify: `packages/db/src/workspace-ai-setting-prisma-store.test.ts`
- Modify: `apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts`
- Modify: `apps/web/app/(app)/settings/ai-intake/ai-intake-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Add tests that expect the new role to return defaults and persist custom prompt/model:

```ts
it("returns built-in CRM entity extractor defaults when no row exists", async () => {
  const store = createWorkspaceAiSettingPrismaStore(client);

  await expect(store.getCrmEntityExtractor("workspace-1")).resolves.toMatchObject({
    workspaceId: "workspace-1",
    role: "crm_entity_extractor",
    model: CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL,
    prompt: CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT,
    updatedAt: null
  });
});

it("upserts CRM entity extractor prompt and model for one workspace", async () => {
  const store = createWorkspaceAiSettingPrismaStore(client);
  await store.upsertCrmEntityExtractor({
    workspaceId: "workspace-1",
    model: "gpt-5.2",
    prompt: "Extract CRM entities from incoming lead messages and return JSON."
  });

  await expect(store.getCrmEntityExtractor("workspace-1")).resolves.toMatchObject({
    role: "crm_entity_extractor",
    model: "gpt-5.2",
    prompt: "Extract CRM entities from incoming lead messages and return JSON."
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @app/db test -- workspace-ai-setting-prisma-store.test.ts
pnpm --filter @app/web test -- ai-intake-store.test.ts
```

Expected: FAIL because `getCrmEntityExtractor`, `upsertCrmEntityExtractor`, and defaults do not exist.

- [ ] **Step 3: Add role constants and store methods**

In `packages/db/src/workspace-ai-setting-prisma-store.ts`, add:

```ts
export const CRM_ENTITY_EXTRACTOR_ROLE = "crm_entity_extractor" as const;
export const CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL = "gpt-4.1-mini";
export const CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT = [
  "# CRM Entity Extractor Agent",
  "",
  "You are a CRM analyst for an architecture bureau.",
  "Your task is to transform natural human messages into structured CRM entities.",
  "Do not mutate CRM data. Do not invent facts. Extract only what is present.",
  "",
  "Extract these entity types:",
  "- FACT: stable information about a lead/client/project",
  "- EVENT: dated or recurring real-world event",
  "- FOLLOW_UP: future action that someone should perform",
  "- PERSON: person mentioned in the message",
  "- ORGANIZATION: company, bureau, institution, contractor, authority",
  "- TAG: normalized searchable label",
  "",
  "Preserve the original language for names, places, and project labels.",
  "For project/location names, use the language of the recognized location when clear.",
  "Return strictly valid JSON matching the provided schema."
].join("\n");
```

Extend:

```ts
export type WorkspaceAiSettingRole =
  | typeof CLIENT_MATERIAL_ANALYSIS_ROLE
  | typeof CRM_ORCHESTRATOR_ROLE
  | typeof CRM_ENTITY_EXTRACTOR_ROLE;
```

Add input type and store methods:

```ts
export type UpsertCrmEntityExtractorSettingInput = {
  workspaceId: string;
  model: string;
  prompt: string;
};

export type WorkspaceAiSettingStore = {
  getClientMaterialAnalysis(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertClientMaterialAnalysis(input: UpsertClientMaterialAnalysisSettingInput): Promise<WorkspaceAiSettingRecord>;
  getCrmOrchestrator(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertCrmOrchestrator(input: UpsertCrmOrchestratorSettingInput): Promise<WorkspaceAiSettingRecord>;
  getCrmEntityExtractor(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertCrmEntityExtractor(input: UpsertCrmEntityExtractorSettingInput): Promise<WorkspaceAiSettingRecord>;
};
```

Add `getCrmEntityExtractor`, `upsertCrmEntityExtractor`, and `createDefaultCrmEntityExtractorSetting` following the existing orchestrator pattern.

- [ ] **Step 4: Extend Web memory store**

In `apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts`, add:

```ts
export const CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-5", label: "GPT-5" },
  { id: "gpt-5.1", label: "GPT-5.1" },
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 pro" }
] as const;
```

Add `getCrmEntityExtractorSetting` and `saveCrmEntityExtractorSetting`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
pnpm --filter @app/db test -- workspace-ai-setting-prisma-store.test.ts
pnpm --filter @app/web test -- ai-intake-store.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/db/src/workspace-ai-setting-prisma-store.ts packages/db/src/workspace-ai-setting-prisma-store.test.ts apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts apps/web/app/(app)/settings/ai-intake/ai-intake-store.test.ts
git commit -m "feat: add crm entity extractor ai settings role"
```

---

## Task 2: Settings UI Hierarchy and Entity Extractor Page

**Files:**
- Modify: `apps/web/app/(app)/settings/page.tsx`
- Create: `apps/web/app/(app)/settings/crm-entity-extractor/page.tsx`
- Create: `apps/web/app/(app)/settings/crm-entity-extractor/actions.ts`
- Create: `apps/web/app/(app)/settings/crm-entity-extractor/crm-entity-extractor-settings.test.ts`

- [ ] **Step 1: Write failing UI source tests**

Create `apps/web/app/(app)/settings/crm-entity-extractor/crm-entity-extractor-settings.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsPageSource = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const extractorPageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(join(__dirname, "actions.ts"), "utf8");

describe("crm entity extractor settings UI", () => {
  it("shows orchestrator as the top routing layer and specialized agents below", () => {
    expect(settingsPageSource).toContain("Agent routing");
    expect(settingsPageSource).toContain("CRM orchestrator");
    expect(settingsPageSource).toContain("Specialized agents");
    expect(settingsPageSource).toContain("/settings/crm-entity-extractor");
  });

  it("contains a prompt textarea and model selector for the extractor", () => {
    expect(extractorPageSource).toContain("CRM entity extractor");
    expect(extractorPageSource).toContain("Entity extraction model");
    expect(extractorPageSource).toContain("CRM entity extractor metaprompt");
    expect(extractorPageSource).toContain("textarea");
  });

  it("validates and saves extractor settings", () => {
    expect(actionsSource).toContain("updateCrmEntityExtractorSettingsAction");
    expect(actionsSource).toContain("saveCrmEntityExtractorSetting");
    expect(actionsSource).toContain("Unsupported CRM entity extractor model");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/web test -- crm-entity-extractor-settings.test.ts
```

Expected: FAIL because files/page content do not exist.

- [ ] **Step 3: Create server action**

Create `apps/web/app/(app)/settings/crm-entity-extractor/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS, saveCrmEntityExtractorSetting } from "../ai-intake/ai-intake-store";

export async function updateCrmEntityExtractorSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const model = String(formData.get("model") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const allowedModels = new Set(CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => option.id));

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported CRM entity extractor model.");
  }

  if (prompt.length < 40) {
    throw new Error("CRM entity extractor prompt must be at least 40 characters.");
  }

  await saveCrmEntityExtractorSetting({
    workspaceId: session.workspaceId,
    model,
    prompt
  });

  revalidatePath("/settings/crm-entity-extractor");
}
```

- [ ] **Step 4: Create settings page**

Create `apps/web/app/(app)/settings/crm-entity-extractor/page.tsx`:

```tsx
import { CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS, getCrmEntityExtractorSetting } from "../ai-intake/ai-intake-store";
import { updateCrmEntityExtractorSettingsAction } from "./actions";
import { getWorkspaceSession } from "../../../workspace-session";

export default async function CrmEntityExtractorSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getCrmEntityExtractorSetting(session.workspaceId);

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialized agent</p>
        <h1 className="text-2xl font-semibold">CRM entity extractor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Extract facts, events, follow-ups, people, organizations, and tags after CRM orchestrator routing.
        </p>
      </div>
      <form action={updateCrmEntityExtractorSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium text-foreground">Entity extraction model</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium text-foreground">CRM entity extractor metaprompt</span>
          <textarea
            name="prompt"
            defaultValue={setting.prompt}
            rows={22}
            className="min-h-[420px] rounded-md border border-border bg-white p-3 font-mono text-xs leading-relaxed"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Current role: <span className="font-semibold text-foreground">{setting.role}</span>. This agent does not mutate CRM data directly.
        </p>
        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
          Save CRM entity extractor settings
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 5: Refactor settings hierarchy**

In `apps/web/app/(app)/settings/page.tsx`, add a visual hierarchy:

```tsx
<div className="grid gap-3">
  <div>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agent routing</h2>
    <div className="mt-2 grid gap-3">
      <a href="/settings/crm-orchestrator" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
        <h3 className="text-base font-semibold">CRM orchestrator</h3>
        <p className="mt-2 text-sm text-muted-foreground">Top-level routing prompt for Telegram and assistant requests.</p>
      </a>
    </div>
  </div>
  <div>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Specialized agents</h2>
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      <a href="/settings/ai-intake" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
        <h3 className="text-base font-semibold">AI intake</h3>
        <p className="mt-2 text-sm text-muted-foreground">Metaprompt and model for client material analysis.</p>
      </a>
      <a href="/settings/crm-entity-extractor" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
        <h3 className="text-base font-semibold">CRM entity extractor</h3>
        <p className="mt-2 text-sm text-muted-foreground">Facts, events, follow-ups, people, organizations, and tags.</p>
      </a>
    </div>
  </div>
</div>
```

Keep language, branding, price table, templates, and danger zone visible below or above the agent section.

- [ ] **Step 6: Run test and commit**

Run:

```powershell
pnpm --filter @app/web test -- crm-entity-extractor-settings.test.ts
```

Expected: PASS.

Commit:

```powershell
git add apps/web/app/(app)/settings/page.tsx apps/web/app/(app)/settings/crm-entity-extractor apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts apps/web/app/(app)/settings/ai-intake/ai-intake-store.test.ts
git commit -m "feat: add crm entity extractor settings page"
```

---

## Task 3: Entity Extractor Contract and Deterministic Fallback

**Files:**
- Create: `packages/assistant/src/crm-entity-extractor.ts`
- Create: `packages/assistant/src/crm-entity-extractor.test.ts`
- Modify: `packages/assistant/src/index.ts`

- [ ] **Step 1: Write failing contract tests**

Create `packages/assistant/src/crm-entity-extractor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDeterministicCrmEntityExtraction, normalizeCrmEntityExtraction } from "./crm-entity-extractor";

describe("crm entity extractor", () => {
  it("extracts explicit Russian follow-up, person, and tags", () => {
    const extraction = createDeterministicCrmEntityExtraction({
      text: "Напомни завтра маякнуть Артему и запросить документы по участку в Вестфалии. Он инвестор, интересуется реконструкцией.",
      receivedAt: "2026-06-02T10:00:00.000Z",
      timezone: "Europe/Paris"
    });

    expect(extraction.followups[0]).toMatchObject({
      type: "FOLLOW_UP",
      title: "маякнуть Артему и запросить документы по участку в Вестфалии"
    });
    expect(extraction.people).toContainEqual(expect.objectContaining({ label: "Артему" }));
    expect(extraction.tags.map((tag) => tag.value)).toEqual(expect.arrayContaining(["business_investor", "project_reconstruction"]));
  });

  it("normalizes invalid AI JSON into empty arrays and medium confidence", () => {
    const extraction = normalizeCrmEntityExtraction({
      facts: [{ value: "Client likes jazz", confidence: "high" }],
      confidence: { overall: "high" }
    });

    expect(extraction.facts).toHaveLength(1);
    expect(extraction.events).toEqual([]);
    expect(extraction.followups).toEqual([]);
    expect(extraction.people).toEqual([]);
    expect(extraction.organizations).toEqual([]);
    expect(extraction.tags).toEqual([]);
    expect(extraction.confidence.overall).toBe("high");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- crm-entity-extractor.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Create extractor types and normalization**

Create `packages/assistant/src/crm-entity-extractor.ts`:

```ts
export type CrmEntityConfidence = "high" | "medium" | "low";

export type CrmExtractedEntityType = "FACT" | "EVENT" | "FOLLOW_UP" | "PERSON" | "ORGANIZATION" | "TAG";

export type CrmExtractedEntity = {
  type: CrmExtractedEntityType;
  label: string;
  value: string;
  sourceText: string;
  confidence: CrmEntityConfidence;
  leadFieldHint?: string | null;
};

export type CrmExtractedFollowup = CrmExtractedEntity & {
  type: "FOLLOW_UP";
  title: string;
  dueAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly" | null;
  assigneeHint: string | null;
};

export type CrmExtractedEvent = CrmExtractedEntity & {
  type: "EVENT";
  startsAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly" | null;
};

export type CrmExtractedTag = CrmExtractedEntity & {
  type: "TAG";
  normalizedKey: string;
};

export type CrmEntityExtraction = {
  facts: CrmExtractedEntity[];
  events: CrmExtractedEvent[];
  followups: CrmExtractedFollowup[];
  people: CrmExtractedEntity[];
  organizations: CrmExtractedEntity[];
  tags: CrmExtractedTag[];
  leadNaming: {
    displayName: string | null;
    projectPlace: string | null;
    language: string | null;
    country: string | null;
  };
  confidence: {
    overall: CrmEntityConfidence;
  };
  summary: string;
};
```

Add normalization helpers that coerce missing arrays to `[]`, strings to trimmed values, confidence to `medium`, and entity type-specific arrays to their exact types.

- [ ] **Step 4: Add deterministic fallback parser**

Add `createDeterministicCrmEntityExtraction(input)` with lightweight rules:

- Detect Russian reminder verbs: `напомни`, `маякнуть`, `пингануть`, `допинать`, `запросить`, `проверить`, `узнать`, `написать`.
- Detect English reminder verbs: `remind`, `follow up`, `ping`, `ask`, `check`, `write`, `call`.
- Detect people as capitalized Cyrillic/Latin names near action verbs.
- Detect tags:
  - `инвестор|investor` -> `business_investor`
  - `реконструкц|reconstruction` -> `project_reconstruction`
  - `документ|document` -> `needs_documents`
  - `джаз|jazz` -> `interest_jazz`
  - `земл|участ|plot|land` -> `project_land_plot`
- Detect yearly recurrence if text includes `каждый год`, `ежегодно`, `birthday`, `день рождения`.
- Use `receivedAt` and timezone only for explicit `завтра|tomorrow` due dates.

- [ ] **Step 5: Export and test**

In `packages/assistant/src/index.ts`, add:

```ts
export * from "./crm-entity-extractor";
```

Run:

```powershell
pnpm --filter @app/assistant test -- crm-entity-extractor.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/crm-entity-extractor.ts packages/assistant/src/crm-entity-extractor.test.ts packages/assistant/src/index.ts
git commit -m "feat: add crm entity extractor contract"
```

---

## Task 4: OpenAI CRM Entity Extractor Adapter

**Files:**
- Create: `packages/assistant/src/openai-crm-entity-extractor.ts`
- Create: `packages/assistant/src/openai-crm-entity-extractor.test.ts`
- Modify: `packages/assistant/src/index.ts`

- [ ] **Step 1: Write failing OpenAI adapter tests**

Create `packages/assistant/src/openai-crm-entity-extractor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOpenAiCrmEntityExtractor } from "./openai-crm-entity-extractor";

describe("openai crm entity extractor", () => {
  it("posts prompt, model, message context, and schema to Responses API", async () => {
    const calls: unknown[] = [];
    const extractor = createOpenAiCrmEntityExtractor({
      apiKey: "test-key",
      model: "gpt-5.2",
      prompt: "Extract CRM entities.",
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({
          output_text: JSON.stringify({
            facts: [],
            events: [],
            followups: [{ type: "FOLLOW_UP", label: "Call Artem", value: "Call Artem", title: "Call Artem", dueAt: null, recurrence: "none", assigneeHint: null, sourceText: "call Artem", confidence: "high" }],
            people: [{ type: "PERSON", label: "Artem", value: "Artem", sourceText: "call Artem", confidence: "high" }],
            organizations: [],
            tags: [],
            leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
            confidence: { overall: "high" },
            summary: "User asked to call Artem."
          })
        }), { status: 200 });
      }
    });

    const result = await extractor.extract({
      channel: "telegram",
      workspaceId: "workspace-1",
      messageId: "message-1",
      leadId: "L-2026-001",
      text: "call Artem",
      receivedAt: "2026-06-02T10:00:00.000Z",
      attachments: []
    });

    expect(result.followups[0].title).toBe("Call Artem");
    expect(JSON.stringify(calls[0])).toContain("Extract CRM entities.");
    expect(JSON.stringify(calls[0])).toContain("gpt-5.2");
    expect(JSON.stringify(calls[0])).toContain("crm_entity_extraction");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- openai-crm-entity-extractor.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement adapter**

Create `packages/assistant/src/openai-crm-entity-extractor.ts`:

```ts
import { normalizeCrmEntityExtraction, type CrmEntityExtraction } from "./crm-entity-extractor";

export type CrmEntityExtractorInput = {
  channel: "telegram" | "web";
  workspaceId: string;
  messageId: string;
  leadId?: string | null;
  text: string;
  receivedAt: string;
  attachments: Array<{ kind: string; fileName: string; summary?: string | null }>;
};

export type CrmEntityExtractorClient = {
  extract(input: CrmEntityExtractorInput): Promise<CrmEntityExtraction>;
};

export function createOpenAiCrmEntityExtractor(config: {
  apiKey: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): CrmEntityExtractorClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async extract(input) {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            { role: "system", content: config.prompt },
            { role: "user", content: JSON.stringify(input) }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "crm_entity_extraction",
              schema: createCrmEntityExtractionJsonSchema()
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI CRM entity extractor request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const outputText = extractResponseOutputText(payload);
      if (!outputText) {
        throw new Error("OpenAI CRM entity extractor response did not include output_text");
      }

      return normalizeCrmEntityExtraction(JSON.parse(outputText));
    }
  };
}
```

Add `createCrmEntityExtractionJsonSchema()` with required top-level fields:

```ts
["facts", "events", "followups", "people", "organizations", "tags", "leadNaming", "confidence", "summary"]
```

Use `additionalProperties: false` at the top level and on nested objects.

- [ ] **Step 4: Export and test**

In `packages/assistant/src/index.ts`, add:

```ts
export * from "./openai-crm-entity-extractor";
```

Run:

```powershell
pnpm --filter @app/assistant test -- openai-crm-entity-extractor.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/openai-crm-entity-extractor.ts packages/assistant/src/openai-crm-entity-extractor.test.ts packages/assistant/src/index.ts
git commit -m "feat: add openai crm entity extractor"
```

---

## Task 5: Database Models for Extracted Entities and Calendar Actions

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260602120000_crm_entity_extractor/migration.sql`
- Create: `packages/db/src/crm-entity-prisma-store.ts`
- Create: `packages/db/src/crm-entity-prisma-store.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write failing Prisma store test**

Create `packages/db/src/crm-entity-prisma-store.test.ts` using a mock Prisma-like client:

```ts
import { describe, expect, it } from "vitest";
import { createCrmEntityPrismaStore } from "./crm-entity-prisma-store";

describe("crm entity prisma store", () => {
  it("persists extracted lead entities and calendar actions in one call", async () => {
    const calls: Array<{ model: string; method: string; args: unknown }> = [];
    const client = {
      leadContextEntity: {
        createMany: async (args: unknown) => {
          calls.push({ model: "leadContextEntity", method: "createMany", args });
          return { count: 2 };
        }
      },
      crmCalendarAction: {
        createMany: async (args: unknown) => {
          calls.push({ model: "crmCalendarAction", method: "createMany", args });
          return { count: 1 };
        }
      },
      auditLog: {
        createMany: async (args: unknown) => {
          calls.push({ model: "auditLog", method: "createMany", args });
          return { count: 1 };
        }
      }
    };

    const store = createCrmEntityPrismaStore(client);
    await store.saveLeadEntityExtraction({
      workspaceId: "workspace-1",
      leadRecordId: "lead-record-1",
      leadId: "L-2026-001",
      sourceChannel: "telegram",
      sourceMessageId: "message-1",
      actorUserId: "telegram:123",
      entities: [
        { type: "FACT", label: "Interest", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" },
        { type: "TAG", label: "jazz", value: "interest_jazz", sourceText: "likes jazz", confidence: "high", normalizedKey: "interest_jazz" }
      ],
      calendarActions: [
        { title: "Call Artem", description: "Ask about documents", dueAt: new Date("2026-06-03T09:00:00.000Z"), recurrence: "none" }
      ],
      summary: "Saved CRM context."
    });

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual([
      "leadContextEntity.createMany",
      "crmCalendarAction.createMany",
      "auditLog.createMany"
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/db test -- crm-entity-prisma-store.test.ts
```

Expected: FAIL because store does not exist.

- [ ] **Step 3: Add Prisma models**

In `packages/db/prisma/schema.prisma`, add to `Workspace`:

```prisma
leadContextEntities LeadContextEntity[]
crmCalendarActions  CrmCalendarAction[]
```

Add to `Lead`:

```prisma
displayName         String?
language            String?
country             String?
searchTags          Json?
contextEntities     LeadContextEntity[]
calendarActions     CrmCalendarAction[]
```

Add models:

```prisma
model LeadContextEntity {
  id              String   @id @default(cuid())
  workspaceId     String
  leadRecordId    String
  sourceChannel   String
  sourceMessageId String?
  entityType      String
  label           String
  value           String
  normalizedKey   String?
  sourceText      String?  @db.Text
  confidence      String
  actorUserId     String?
  createdAt       DateTime @default(now())

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  lead            Lead      @relation(fields: [leadRecordId], references: [id])

  @@index([workspaceId, entityType])
  @@index([leadRecordId, createdAt])
  @@index([workspaceId, normalizedKey])
}

model CrmCalendarAction {
  id              String   @id @default(cuid())
  workspaceId     String
  leadRecordId    String?
  title           String
  description     String?  @db.Text
  dueAt           DateTime?
  recurrence      String?
  status          String   @default("planned")
  sourceChannel   String?
  sourceMessageId String?
  actorUserId     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  lead            Lead?     @relation(fields: [leadRecordId], references: [id])

  @@index([workspaceId, status, dueAt])
  @@index([leadRecordId, createdAt])
}
```

- [ ] **Step 4: Add SQL migration**

Create `packages/db/prisma/migrations/20260602120000_crm_entity_extractor/migration.sql`:

```sql
ALTER TABLE "Lead" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Lead" ADD COLUMN "language" TEXT;
ALTER TABLE "Lead" ADD COLUMN "country" TEXT;
ALTER TABLE "Lead" ADD COLUMN "searchTags" JSONB;

CREATE TABLE "LeadContextEntity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadRecordId" TEXT NOT NULL,
  "sourceChannel" TEXT NOT NULL,
  "sourceMessageId" TEXT,
  "entityType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedKey" TEXT,
  "sourceText" TEXT,
  "confidence" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadContextEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCalendarAction" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadRecordId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "recurrence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "sourceChannel" TEXT,
  "sourceMessageId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmCalendarAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadContextEntity_workspaceId_entityType_idx" ON "LeadContextEntity"("workspaceId", "entityType");
CREATE INDEX "LeadContextEntity_leadRecordId_createdAt_idx" ON "LeadContextEntity"("leadRecordId", "createdAt");
CREATE INDEX "LeadContextEntity_workspaceId_normalizedKey_idx" ON "LeadContextEntity"("workspaceId", "normalizedKey");
CREATE INDEX "CrmCalendarAction_workspaceId_status_dueAt_idx" ON "CrmCalendarAction"("workspaceId", "status", "dueAt");
CREATE INDEX "CrmCalendarAction_leadRecordId_createdAt_idx" ON "CrmCalendarAction"("leadRecordId", "createdAt");

ALTER TABLE "LeadContextEntity" ADD CONSTRAINT "LeadContextEntity_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadContextEntity" ADD CONSTRAINT "LeadContextEntity_leadRecordId_fkey"
  FOREIGN KEY ("leadRecordId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmCalendarAction" ADD CONSTRAINT "CrmCalendarAction_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmCalendarAction" ADD CONSTRAINT "CrmCalendarAction_leadRecordId_fkey"
  FOREIGN KEY ("leadRecordId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Implement store**

Create `packages/db/src/crm-entity-prisma-store.ts`:

```ts
export type SaveLeadEntityExtractionInput = {
  workspaceId: string;
  leadRecordId: string;
  leadId: string;
  sourceChannel: string;
  sourceMessageId?: string | null;
  actorUserId?: string | null;
  entities: Array<{
    type: string;
    label: string;
    value: string;
    normalizedKey?: string | null;
    sourceText?: string | null;
    confidence: string;
  }>;
  calendarActions: Array<{
    title: string;
    description?: string | null;
    dueAt?: Date | null;
    recurrence?: string | null;
  }>;
  summary: string;
};

export type CrmEntityPrismaLike = {
  leadContextEntity: { createMany(args: unknown): Promise<{ count: number }> };
  crmCalendarAction: { createMany(args: unknown): Promise<{ count: number }> };
  auditLog: { createMany(args: unknown): Promise<{ count: number }> };
};

export function createCrmEntityPrismaStore(client: CrmEntityPrismaLike) {
  return {
    async saveLeadEntityExtraction(input: SaveLeadEntityExtractionInput) {
      await client.leadContextEntity.createMany({
        data: input.entities.map((entity) => ({
          workspaceId: input.workspaceId,
          leadRecordId: input.leadRecordId,
          sourceChannel: input.sourceChannel,
          sourceMessageId: input.sourceMessageId ?? null,
          entityType: entity.type,
          label: entity.label,
          value: entity.value,
          normalizedKey: entity.normalizedKey ?? null,
          sourceText: entity.sourceText ?? null,
          confidence: entity.confidence,
          actorUserId: input.actorUserId ?? null
        }))
      });

      await client.crmCalendarAction.createMany({
        data: input.calendarActions.map((action) => ({
          workspaceId: input.workspaceId,
          leadRecordId: input.leadRecordId,
          title: action.title,
          description: action.description ?? null,
          dueAt: action.dueAt ?? null,
          recurrence: action.recurrence ?? null,
          sourceChannel: input.sourceChannel,
          sourceMessageId: input.sourceMessageId ?? null,
          actorUserId: input.actorUserId ?? null
        }))
      });

      await client.auditLog.createMany({
        data: [{
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId ?? null,
          action: "lead.entity_extraction_saved",
          targetType: "lead",
          targetId: input.leadId,
          metadata: {
            summary: input.summary,
            entityCount: input.entities.length,
            calendarActionCount: input.calendarActions.length
          }
        }]
      });
    }
  };
}
```

- [ ] **Step 6: Export store and run tests**

In `packages/db/src/index.ts`, export:

```ts
export * from "./crm-entity-prisma-store";
```

Run:

```powershell
pnpm --filter @app/db test -- crm-entity-prisma-store.test.ts
pnpm --filter @app/db typecheck
```

Expected: PASS.

Commit:

```powershell
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260602120000_crm_entity_extractor packages/db/src/crm-entity-prisma-store.ts packages/db/src/crm-entity-prisma-store.test.ts packages/db/src/index.ts
git commit -m "feat: persist crm extracted entities and calendar actions"
```

---

## Task 6: Lead Display Name and Search Tags

**Files:**
- Create: `packages/assistant/src/lead-display-name.ts`
- Create: `packages/assistant/src/lead-display-name.test.ts`
- Modify: `packages/assistant/src/index.ts`
- Modify: `packages/db/src/assistant-lead-prisma-store.ts`
- Modify: `packages/db/src/assistant-lead-prisma-store.test.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] **Step 1: Write failing display name tests**

Create `packages/assistant/src/lead-display-name.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLeadDisplayMetadata } from "./lead-display-name";

describe("lead display name", () => {
  it("uses client plus German place in original local language", () => {
    expect(createLeadDisplayMetadata({
      clientName: "Irina Schneider",
      projectAddress: "Gartenweg 9, Bad Aibling, Deutschland",
      requestType: "Neubau EFH"
    })).toEqual({
      displayName: "Irina Schneider - Neubau EFH in Bad Aibling",
      language: "de",
      country: "Germany",
      searchTags: ["irina_schneider", "neubau_efh", "bad_aibling", "germany"]
    });
  });

  it("uses Russian place and Russian object wording for Russian projects", () => {
    expect(createLeadDisplayMetadata({
      clientName: "Артем",
      projectAddress: "Сочи, улица Морская 12",
      requestType: "дом 120 метров"
    }).displayName).toBe("Артем - дом 120 метров в Сочи");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- lead-display-name.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement metadata helper**

Create `packages/assistant/src/lead-display-name.ts`:

```ts
export type LeadDisplayMetadataInput = {
  clientName?: string | null;
  projectAddress?: string | null;
  requestType?: string | null;
  leadSummary?: string | null;
};

export type LeadDisplayMetadata = {
  displayName: string | null;
  language: string | null;
  country: string | null;
  searchTags: string[];
};

export function createLeadDisplayMetadata(input: LeadDisplayMetadataInput): LeadDisplayMetadata {
  const client = clean(input.clientName);
  const request = clean(input.requestType);
  const place = extractPlace(input.projectAddress ?? input.leadSummary ?? "");
  const language = detectLanguage(input.projectAddress ?? input.leadSummary ?? request ?? client ?? "");
  const country = detectCountry(input.projectAddress ?? input.leadSummary ?? "");
  const inWord = language === "ru" ? "в" : "in";
  const titleParts = [client, request].filter(Boolean);
  const displayName = titleParts.length || place ? `${titleParts.join(" - ")}${place ? ` ${inWord} ${place}` : ""}`.trim() : null;

  return {
    displayName,
    language,
    country,
    searchTags: createSearchTags([client, request, place, country].filter(Boolean) as string[])
  };
}
```

Add `extractPlace` with common comma-separated address handling:

- For German addresses, prefer city-like segment before `Germany|Deutschland|Bayern|NRW`.
- For Russian addresses, prefer first city-like segment such as `Москва`, `Сочи`, `Санкт-Петербург`.
- Fall back to the shortest meaningful address segment.

- [ ] **Step 4: Export and wire into lead creation/update data**

In `packages/assistant/src/index.ts`, add:

```ts
export * from "./lead-display-name";
```

In `packages/integrations/src/telegram/telegram-worker.ts`, when creating or updating a lead, compute:

```ts
const displayMetadata = createLeadDisplayMetadata({
  clientName: draft.clientName,
  requestType: draft.requestType,
  projectAddress: draft.projectAddress,
  leadSummary: draft.rawInput
});
```

Persist:

```ts
displayName: displayMetadata.displayName,
language: displayMetadata.language,
country: displayMetadata.country,
searchTags: displayMetadata.searchTags
```

In `packages/db/src/assistant-lead-prisma-store.ts`, add the same fields when Web Assistant creates leads.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
pnpm --filter @app/assistant test -- lead-display-name.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/db test -- assistant-lead-prisma-store.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/lead-display-name.ts packages/assistant/src/lead-display-name.test.ts packages/assistant/src/index.ts packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts packages/db/src/assistant-lead-prisma-store.ts packages/db/src/assistant-lead-prisma-store.test.ts
git commit -m "feat: add localized lead display names"
```

---

## Task 7: Entity Router to Lead Context and Calendar Action Drafts

**Files:**
- Create: `packages/assistant/src/crm-entity-router.ts`
- Create: `packages/assistant/src/crm-entity-router.test.ts`
- Modify: `packages/assistant/src/index.ts`

- [ ] **Step 1: Write failing router tests**

Create `packages/assistant/src/crm-entity-router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCrmEntityPersistencePlan } from "./crm-entity-router";

describe("crm entity router", () => {
  it("routes facts, people, organizations, and tags into lead context entities", () => {
    const plan = createCrmEntityPersistencePlan({
      leadId: "L-2026-001",
      extraction: {
        facts: [{ type: "FACT", label: "Interest", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" }],
        people: [{ type: "PERSON", label: "Artem", value: "Artem", sourceText: "Artem", confidence: "high" }],
        organizations: [],
        tags: [{ type: "TAG", label: "jazz", value: "interest_jazz", normalizedKey: "interest_jazz", sourceText: "jazz", confidence: "high" }],
        events: [],
        followups: [],
        leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
        confidence: { overall: "high" },
        summary: "Saved context."
      }
    });

    expect(plan.entities.map((entity) => entity.type)).toEqual(["FACT", "PERSON", "TAG"]);
    expect(plan.calendarActions).toEqual([]);
    expect(plan.historySummary).toContain("Saved context");
  });

  it("routes follow-ups and events into calendar actions", () => {
    const plan = createCrmEntityPersistencePlan({
      leadId: "L-2026-001",
      extraction: {
        facts: [],
        people: [],
        organizations: [],
        tags: [],
        events: [{ type: "EVENT", label: "Birthday", value: "Birthday", startsAt: "2026-06-14T09:00:00.000Z", recurrence: "yearly", sourceText: "birthday 14 June", confidence: "high" }],
        followups: [{ type: "FOLLOW_UP", label: "Call", value: "Call client", title: "Call client", dueAt: "2026-06-03T09:00:00.000Z", recurrence: "none", assigneeHint: null, sourceText: "call tomorrow", confidence: "high" }],
        leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
        confidence: { overall: "high" },
        summary: "Created future actions."
      }
    });

    expect(plan.calendarActions).toHaveLength(2);
    expect(plan.calendarActions[0]).toMatchObject({ title: "Call client", recurrence: "none" });
    expect(plan.calendarActions[1]).toMatchObject({ title: "Birthday", recurrence: "yearly" });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- crm-entity-router.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement router**

Create `packages/assistant/src/crm-entity-router.ts`:

```ts
import type { CrmEntityExtraction } from "./crm-entity-extractor";

export type CrmEntityPersistencePlan = {
  entities: Array<{
    type: string;
    label: string;
    value: string;
    normalizedKey?: string | null;
    sourceText?: string | null;
    confidence: string;
  }>;
  calendarActions: Array<{
    title: string;
    description?: string | null;
    dueAt?: Date | null;
    recurrence?: string | null;
  }>;
  historySummary: string;
};

export function createCrmEntityPersistencePlan(input: {
  leadId: string;
  extraction: CrmEntityExtraction;
}): CrmEntityPersistencePlan {
  const entities = [
    ...input.extraction.facts,
    ...input.extraction.people,
    ...input.extraction.organizations,
    ...input.extraction.tags
  ].map((entity) => ({
    type: entity.type,
    label: entity.label,
    value: entity.value,
    normalizedKey: "normalizedKey" in entity ? entity.normalizedKey : null,
    sourceText: entity.sourceText,
    confidence: entity.confidence
  }));

  const followupActions = input.extraction.followups.map((followup) => ({
    title: followup.title,
    description: followup.value,
    dueAt: followup.dueAt ? new Date(followup.dueAt) : null,
    recurrence: followup.recurrence ?? "none"
  }));

  const eventActions = input.extraction.events.map((event) => ({
    title: event.label,
    description: event.value,
    dueAt: event.startsAt ? new Date(event.startsAt) : null,
    recurrence: event.recurrence ?? "none"
  }));

  return {
    entities,
    calendarActions: [...followupActions, ...eventActions],
    historySummary: `${input.extraction.summary} Entities: ${entities.length}. Future actions: ${followupActions.length + eventActions.length}.`
  };
}
```

- [ ] **Step 4: Export and test**

In `packages/assistant/src/index.ts`, add:

```ts
export * from "./crm-entity-router";
```

Run:

```powershell
pnpm --filter @app/assistant test -- crm-entity-router.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/crm-entity-router.ts packages/assistant/src/crm-entity-router.test.ts packages/assistant/src/index.ts
git commit -m "feat: route extracted entities to lead context"
```

---

## Task 8: Telegram Integration After CRM Orchestrator

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker-loop.ts`

- [ ] **Step 1: Write failing Telegram integration tests**

Add tests in `packages/integrations/src/telegram/telegram-worker.test.ts`:

```ts
it("runs CRM entity extractor for a replied lead note and saves entities plus CRM button", async () => {
  const savedExtractions: unknown[] = [];
  const result = await processTelegramUpdates([replyToLeadUpdate], {
    ...baseConfig,
    crmEntityExtractor: {
      extract: async () => ({
        facts: [{ type: "FACT", label: "Preference", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" }],
        events: [],
        followups: [],
        people: [],
        organizations: [],
        tags: [{ type: "TAG", label: "jazz", value: "interest_jazz", normalizedKey: "interest_jazz", sourceText: "jazz", confidence: "high" }],
        leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
        confidence: { overall: "high" },
        summary: "Client likes jazz."
      })
    },
    saveLeadEntityExtraction: async (input) => savedExtractions.push(input)
  });

  expect(result.processed).toBe(1);
  expect(savedExtractions).toHaveLength(1);
  expect(sentMessages[0].reply_markup.inline_keyboard[0][0].text).toBe("CRM");
});

it("runs CRM entity extractor after creating a new lead and stores lead naming metadata", async () => {
  const createdLeads: unknown[] = [];
  await processTelegramUpdates([leadCreationUpdate], {
    ...baseConfig,
    prisma: {
      ...basePrisma,
      lead: {
        ...basePrisma.lead,
        create: async (args) => {
          createdLeads.push(args);
          return { id: "lead-record-1", leadId: "L-2026-050", status: "new" };
        }
      }
    },
    crmEntityExtractor: deterministicExtractorForMunichLead
  });

  expect(JSON.stringify(createdLeads[0])).toContain("displayName");
  expect(JSON.stringify(createdLeads[0])).toContain("Munich");
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: FAIL because `crmEntityExtractor` and `saveLeadEntityExtraction` ports do not exist.

- [ ] **Step 3: Add worker ports**

Extend `TelegramWorkerConfig`:

```ts
crmEntityExtractor?: CrmEntityExtractorClient;
saveLeadEntityExtraction?: (input: SaveLeadEntityExtractionInput) => Promise<void>;
```

Import from assistant/db:

```ts
import { createCrmEntityPersistencePlan, createLeadDisplayMetadata, type CrmEntityExtractorClient } from "@app/assistant";
import type { SaveLeadEntityExtractionInput } from "@app/db";
```

- [ ] **Step 4: Run extractor after note/update/create**

Add helper:

```ts
async function saveExtractedLeadEntitiesForTelegram(config, message, lead, text) {
  if (!config.crmEntityExtractor || !config.saveLeadEntityExtraction || !lead.id) {
    return null;
  }

  const extraction = await config.crmEntityExtractor.extract({
    channel: "telegram",
    workspaceId: config.workspaceId,
    messageId: String(message.messageId),
    leadId: lead.leadId,
    text,
    receivedAt: message.receivedAt,
    attachments: message.attachments.map((attachment) => ({
      kind: attachment.kind,
      fileName: attachment.fileName,
      summary: attachment.summary ?? null
    }))
  });
  const plan = createCrmEntityPersistencePlan({ leadId: lead.leadId, extraction });

  await config.saveLeadEntityExtraction({
    workspaceId: config.workspaceId,
    leadRecordId: lead.id,
    leadId: lead.leadId,
    sourceChannel: "telegram",
    sourceMessageId: String(message.messageId),
    actorUserId: `telegram:${message.chatId}`,
    entities: plan.entities,
    calendarActions: plan.calendarActions,
    summary: plan.historySummary
  });

  return { extraction, plan };
}
```

Call this helper after:

- reply lead note/reminder handling;
- reply lead source-material update;
- likely update branch;
- new lead creation branch.

If extractor throws, log warning and keep the original Telegram create/update response working.

- [ ] **Step 5: Wire runtime from env**

In `runTelegramWorkerFromEnv` or the existing worker-loop env factory, load:

- `workspaceAiSettingStore.getCrmEntityExtractor(workspaceId)`
- `createOpenAiCrmEntityExtractor({ apiKey, model, prompt })`
- `createCrmEntityPrismaStore(prisma).saveLeadEntityExtraction`

Only enable OpenAI extractor when `OPENAI_API_KEY` is present; otherwise skip extractor but keep worker running.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/integrations typecheck
```

Expected: PASS.

Commit:

```powershell
git add packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts packages/integrations/src/telegram/telegram-worker-loop.ts
git commit -m "feat: run crm entity extractor in telegram"
```

---

## Task 9: Web Assistant Integration

**Files:**
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `apps/web/app/(app)/assistant/repository.ts`
- Modify: `packages/assistant/src/openai-provider.ts`
- Modify: `packages/assistant/src/openai-provider.test.ts`
- Modify: `packages/assistant/src/submission.ts`
- Modify: `packages/assistant/src/submission.test.ts`

- [ ] **Step 1: Write failing Web Assistant tests**

Add tests that selected-lead Web messages run through extractor:

```ts
it("extracts CRM entities from a selected-lead web note before returning response", async () => {
  const result = await createOpenAIAssistantSubmissionResult({
    context: { ...baseContext, module: "leads", selectedRecordIds: ["L-2026-004"] },
    content: "Запомни о клиенте: вчера встретились за кофе, он любит джаз. Напомни через неделю написать ему.",
    threadId: "thread-entity-extract",
    messageId: "message-entity-extract",
    lead: selectedLeadSnapshot
  }, {
    apiKey: "test",
    model: "gpt-4.1-mini",
    crmEntityExtractor: deterministicEntityExtractor,
    saveLeadEntityExtraction: async (input) => saved.push(input)
  });

  expect(result.response).toContain("Saved");
  expect(saved[0].calendarActions[0].title).toContain("написать");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- openai-provider.test.ts submission.test.ts
```

Expected: FAIL because config does not accept extractor ports.

- [ ] **Step 3: Extend assistant config and submission result flow**

In `packages/assistant/src/openai-provider.ts`, extend `OpenAIAssistantConfig`:

```ts
crmEntityExtractor?: CrmEntityExtractorClient;
saveLeadEntityExtraction?: (input: SaveLeadEntityExtractionInput) => Promise<void>;
```

When selected lead exists and CRM Orchestrator routes to `UPDATE_LEAD` or `CREATE_REMINDER`, run extractor and persist plan. Keep existing deterministic channel response as the visible UX.

- [ ] **Step 4: Wire Web server action**

In `apps/web/app/(app)/assistant/actions.ts`, load setting:

```ts
const entityExtractorSetting = await getCrmEntityExtractorSetting(session.workspaceId);
```

Create extractor:

```ts
const crmEntityExtractor = process.env.OPENAI_API_KEY
  ? createOpenAiCrmEntityExtractor({
      apiKey: process.env.OPENAI_API_KEY,
      model: entityExtractorSetting.model,
      prompt: entityExtractorSetting.prompt
    })
  : undefined;
```

Create DB store:

```ts
const crmEntityStore = createCrmEntityPrismaStore(prisma as never);
```

Pass `crmEntityExtractor` and `saveLeadEntityExtraction`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
pnpm --filter @app/assistant test -- openai-provider.test.ts submission.test.ts
pnpm --filter @app/web test -- assistant
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/openai-provider.ts packages/assistant/src/openai-provider.test.ts packages/assistant/src/submission.ts packages/assistant/src/submission.test.ts apps/web/app/(app)/assistant/actions.ts apps/web/app/(app)/assistant/repository.ts
git commit -m "feat: run crm entity extractor in web assistant"
```

---

## Task 10: Calendar and Future Action History UI

**Files:**
- Modify: `apps/web/app/(app)/today/today-store.ts`
- Modify: `apps/web/app/(app)/today/today-store.test.ts`
- Modify: `apps/web/app/(app)/today/page.tsx`
- Modify: `apps/web/app/(app)/leads/lead-table-store.ts`
- Modify: `apps/web/app/(app)/leads/lead-table-store.test.ts`
- Modify: `apps/web/app/(app)/leads/leads-table.tsx`

- [ ] **Step 1: Write failing Today tests**

Update `apps/web/app/(app)/today/today-store.test.ts`:

```ts
it("maps persisted CRM calendar actions into due follow-up rows", async () => {
  const followups = await createTodayViewModel({
    workspaceId: "workspace-1",
    today: new Date("2026-06-02T00:00:00.000Z"),
    calendarActions: [
      {
        id: "calendar-1",
        title: "Call Artem",
        description: "Ask for documents",
        dueAt: new Date("2026-06-02T09:00:00.000Z"),
        status: "planned",
        leadRecordId: "lead-record-1"
      }
    ]
  });

  expect(followups.items[0]).toMatchObject({
    title: "Call Artem",
    dueDateLabel: "2026-06-02"
  });
});
```

- [ ] **Step 2: Write failing lead card calendar history test**

In `apps/web/app/(app)/leads/lead-table-store.test.ts`, add:

```ts
it("shows future calendar actions in lead history context", () => {
  const history = createLeadHistory({
    ...lead,
    calendarActions: [{
      title: "Call Artem",
      dueAt: "2026-06-03T09:00:00.000Z",
      status: "planned"
    }]
  });

  expect(history.map((item) => item.title)).toContain("Future action planned");
  expect(JSON.stringify(history)).toContain("Call Artem");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```powershell
pnpm --filter @app/web test -- today-store.test.ts lead-table-store.test.ts
```

Expected: FAIL because persisted calendar actions are not read/rendered.

- [ ] **Step 4: Read persisted calendar actions**

In `today-store.ts`, create a DB-backed loader that reads `crmCalendarAction.findMany` for:

```ts
where: {
  workspaceId,
  status: "planned",
  dueAt: { lte: endOfToday }
}
```

Keep memory fallback when no database runtime is active.

- [ ] **Step 5: Add lead card future action section**

In `lead-table-store.ts`, extend the lead view model to accept `calendarActions` and add history items:

```ts
{
  title: "Future action planned",
  description: `${action.title}${action.dueAt ? ` · Due ${formatDate(action.dueAt)}` : ""}`,
  stageLabel: "Calendar"
}
```

In `leads-table.tsx`, ensure the `History` panel renders these like normal history rows.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
pnpm --filter @app/web test -- today-store.test.ts lead-table-store.test.ts
pnpm --filter @app/web typecheck
```

Expected: PASS.

Commit:

```powershell
git add apps/web/app/(app)/today/today-store.ts apps/web/app/(app)/today/today-store.test.ts apps/web/app/(app)/today/page.tsx apps/web/app/(app)/leads/lead-table-store.ts apps/web/app/(app)/leads/lead-table-store.test.ts apps/web/app/(app)/leads/leads-table.tsx
git commit -m "feat: show crm calendar actions"
```

---

## Task 11: Native Lead Search by Display Name, Tags, and Context

**Files:**
- Modify: `packages/assistant/src/lead-search-filter-agent.ts`
- Modify: `packages/assistant/src/lead-search-filter-agent.test.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify: `apps/web/app/(app)/exports/lead-export-filter.ts`
- Modify: `apps/web/app/(app)/exports/lead-export-filter.test.ts`

- [ ] **Step 1: Write failing search tests**

In `packages/assistant/src/lead-search-filter-agent.test.ts`, add:

```ts
it("filters leads by display name and search tags", () => {
  const request = parseLeadSearchFilterRequest("найди землю в Вестфалии");
  const matches = filterLeadSearchRecords([
    { leadId: "L-1", createdDate: "2026-06-01", status: "new", displayName: "Земля в Вестфалии", searchTags: ["westfalen", "project_land_plot"] },
    { leadId: "L-2", createdDate: "2026-06-01", status: "new", displayName: "Дом в Мюнхене", searchTags: ["munich"] }
  ], request);

  expect(matches.map((lead) => lead.leadId)).toEqual(["L-1"]);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/assistant test -- lead-search-filter-agent.test.ts
```

Expected: FAIL because `displayName`, `searchTags`, and query matching are not supported.

- [ ] **Step 3: Extend search records and parser**

In `lead-search-filter-agent.ts`, extend `LeadSearchRecord`:

```ts
displayName?: string | null;
searchTags?: string[] | null;
```

Set `request.filters.query` by removing command words:

```ts
const query = extractSearchQuery(content);
```

Implement `recordMatchesQuery(record, query)` across:

- `leadId`
- `clientName`
- `displayName`
- `projectAddress`
- `requestType`
- `searchTags`

Score display name/tag matches higher than raw address.

- [ ] **Step 4: Wire Telegram `findMany` select**

In Telegram search response, select:

```ts
displayName: true,
searchTags: true
```

Normalize JSON search tags to string array before calling `createLeadSearchFilterResponse`.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
pnpm --filter @app/assistant test -- lead-search-filter-agent.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/web test -- lead-export-filter.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/assistant/src/lead-search-filter-agent.ts packages/assistant/src/lead-search-filter-agent.test.ts packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts apps/web/app/(app)/exports/lead-export-filter.ts apps/web/app/(app)/exports/lead-export-filter.test.ts
git commit -m "feat: search leads by names and crm tags"
```

---

## Task 12: Telegram UX for Extracted Context, Reminders, and Search

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] **Step 1: Write failing UX tests**

Add tests:

```ts
it("answers with saved note and future action summary when extractor finds both", async () => {
  await processTelegramUpdates([replyUpdate], {
    ...baseConfig,
    crmEntityExtractor: extractorWithFactAndFollowup,
    saveLeadEntityExtraction: async () => undefined
  });

  expect(sentMessages[0].text).toContain("Saved to L-2026-004");
  expect(sentMessages[0].text).toContain("Future action");
  expect(sentMessages[0].reply_markup.inline_keyboard[0][0].text).toBe("CRM");
});

it("asks one clarification when extractor confidence is low", async () => {
  await processTelegramUpdates([ambiguousUpdate], {
    ...baseConfig,
    crmEntityExtractor: lowConfidenceExtractor
  });

  expect(sentMessages[0].text).toContain("Do you want me to add this to the existing lead or create a new lead?");
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: FAIL because Telegram response does not summarize extracted entities.

- [ ] **Step 3: Add compact Telegram response formatter**

Add helper in `telegram-worker.ts`:

```ts
function createTelegramEntityExtractionSavedMessage(input: {
  leadId: string;
  entityCount: number;
  calendarActionCount: number;
  summary: string;
}) {
  return [
    `Saved to <b>${escapeHtml(input.leadId)}</b>.`,
    escapeHtml(input.summary),
    input.calendarActionCount > 0 ? `<b>Future actions:</b> ${input.calendarActionCount}` : "",
    input.entityCount > 0 ? `<b>CRM context:</b> ${input.entityCount} items` : ""
  ].filter(Boolean).join("\n");
}
```

Rule:

- If extractor confidence overall is `low` and no reply lead exists, ask one clarification.
- If reply lead exists, save extracted context even at medium confidence, but show short summary.
- Never create feature requests from these messages.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
pnpm --filter @app/integrations test -- telegram-worker.test.ts
```

Expected: PASS.

Commit:

```powershell
git add packages/integrations/src/telegram/telegram-worker.ts packages/integrations/src/telegram/telegram-worker.test.ts
git commit -m "feat: summarize crm entity extraction in telegram"
```

---

## Task 13: Web Lead Card Context Display

**Files:**
- Modify: `apps/web/app/(app)/leads/page.tsx`
- Modify: `apps/web/app/(app)/leads/lead-table-store.ts`
- Modify: `apps/web/app/(app)/leads/lead-table-store.test.ts`
- Modify: `apps/web/app/(app)/leads/leads-table.tsx`

- [ ] **Step 1: Write failing lead card tests**

In `lead-table-store.test.ts`, add:

```ts
it("adds extracted CRM context entities to lead summary info", () => {
  const row = createLeadTableRow({
    lead: baseLead,
    contextEntities: [
      { entityType: "FACT", label: "Interest", value: "Likes jazz", confidence: "high" },
      { entityType: "TAG", label: "jazz", value: "interest_jazz", confidence: "high" }
    ]
  });

  expect(row.crmContextSummary).toContain("Likes jazz");
  expect(row.crmContextSummary).toContain("interest_jazz");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @app/web test -- lead-table-store.test.ts
```

Expected: FAIL because context entities are not part of lead row model.

- [ ] **Step 3: Load context entities in page**

In `apps/web/app/(app)/leads/page.tsx`, include:

```ts
contextEntities: {
  orderBy: { createdAt: "desc" },
  take: 20
},
calendarActions: {
  orderBy: { createdAt: "desc" },
  take: 20
}
```

- [ ] **Step 4: Render compact context block**

In `leads-table.tsx`, add a collapsed block above History or inside Lead Summary Info:

```tsx
<CollapsedPanel title="CRM context" defaultOpen={false}>
  {lead.contextEntities.map((entity) => (
    <div key={entity.id} className="grid gap-1 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{entity.label}</span>
        <span className="text-xs text-muted-foreground">{entity.entityType}</span>
      </div>
      <p className="break-words text-muted-foreground">{entity.value}</p>
    </div>
  ))}
</CollapsedPanel>
```

Use `break-words`, `min-w-0`, and compact mobile spacing so the old mobile strip bug does not return.

- [ ] **Step 5: Run tests and visual check**

Run:

```powershell
pnpm --filter @app/web test -- lead-table-store.test.ts lead-page-layout.test.ts
pnpm --filter @app/web typecheck
```

Then start local app and check mobile lead card:

```powershell
pnpm dev --filter @app/web -- --host 0.0.0.0 --port 3002
```

Expected: Lead card shows normal collapsed panels, not thin strips.

Commit:

```powershell
git add apps/web/app/(app)/leads/page.tsx apps/web/app/(app)/leads/lead-table-store.ts apps/web/app/(app)/leads/lead-table-store.test.ts apps/web/app/(app)/leads/leads-table.tsx
git commit -m "feat: show extracted crm context on lead cards"
```

---

## Task 14: End-to-End Regression Tests

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`
- Modify: `packages/assistant/src/openai-provider.test.ts`
- Modify: `apps/web/app/(app)/settings/settings-danger-zone.test.ts`

- [ ] **Step 1: Add Telegram full-flow test**

Add a test that:

1. Sends source material for a new lead.
2. Creates lead.
3. Runs entity extractor.
4. Saves lead display name/search tags.
5. Saves future action.
6. Replies with CRM button.

Assertions:

```ts
expect(createdLead.data.displayName).toContain("Bad Aibling");
expect(savedExtraction.calendarActions[0].title).toContain("Call");
expect(sentMessages.at(-1)?.reply_markup.inline_keyboard.flat()[0].text).toBe("CRM");
```

- [ ] **Step 2: Add Web full-flow test**

Add a Web Assistant test that:

1. Selected lead exists.
2. User sends `Запомни: клиент любит джаз. Напомни через неделю написать ему.`
3. Extractor returns fact/tag/follow-up.
4. Persistence port receives one fact, one tag, one calendar action.

- [ ] **Step 3: Add Settings smoke test**

Ensure Settings source contains all three AI pages:

```ts
expect(settingsPageSource).toContain("/settings/crm-orchestrator");
expect(settingsPageSource).toContain("/settings/ai-intake");
expect(settingsPageSource).toContain("/settings/crm-entity-extractor");
```

- [ ] **Step 4: Run targeted tests**

Run:

```powershell
pnpm --filter @app/assistant test -- crm-entity-extractor.test.ts openai-crm-entity-extractor.test.ts crm-entity-router.test.ts lead-display-name.test.ts openai-provider.test.ts
pnpm --filter @app/integrations test -- telegram-worker.test.ts
pnpm --filter @app/web test -- crm-entity-extractor-settings.test.ts lead-table-store.test.ts today-store.test.ts
pnpm --filter @app/db test -- workspace-ai-setting-prisma-store.test.ts crm-entity-prisma-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run package typechecks**

Run:

```powershell
pnpm --filter @app/assistant typecheck
pnpm --filter @app/integrations typecheck
pnpm --filter @app/web typecheck
pnpm --filter @app/db typecheck
```

Expected: PASS.

Commit:

```powershell
git add packages apps
git commit -m "test: cover crm entity extraction flows"
```

---

## Task 15: Version, Release Notes, PR

**Files:**
- Modify: `package.json`
- Modify: `docs/VERSIONING.md`
- Modify: `packages/core/src/app/app-metadata.test.ts`
- Create or modify: `docs/RELEASE_NOTES.md`

- [ ] **Step 1: Bump app version**

Bump from `0.3.9` to `0.4.0`, because this adds durable schema and a new agent layer.

In `package.json`:

```json
"version": "0.4.0"
```

Update app metadata/version tests to expect `0.4.0`.

- [ ] **Step 2: Add concise release notes**

Add:

```md
## v0.4.0

- Added CRM Entity Extractor Agent after CRM Orchestrator.
- Added configurable metaprompt/model for entity extraction in Settings.
- Added extracted lead facts, events, people, organizations, tags, and follow-ups.
- Added durable CRM calendar actions and future action history.
- Added localized lead display names and searchable CRM tags.
- Improved Telegram/Web Assistant handling of notes, reminders, and lead context.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
pnpm test
pnpm typecheck
git status --short --branch --untracked-files=all
```

Expected:

- Tests PASS.
- Typecheck PASS.
- Working tree clean after commit.

- [ ] **Step 4: Commit and push**

Commit:

```powershell
git add package.json docs/VERSIONING.md packages/core/src/app/app-metadata.test.ts docs/RELEASE_NOTES.md
git commit -m "chore: release v0.4.0"
git push origin codex/crm-entity-extractor-agent
```

- [ ] **Step 5: Open PR**

Open PR into `main`:

```powershell
gh pr create --base main --head codex/crm-entity-extractor-agent --title "feat: add CRM entity extractor agent" --body "Adds configurable CRM Entity Extractor Agent, durable extracted lead context, future calendar actions, localized lead names, and search tags."
```

Expected: Ready PR URL.

---

## Implementation Order

1. Settings role and store.
2. Settings page and hierarchy.
3. Extractor contract.
4. OpenAI extractor adapter.
5. Durable database schema.
6. Lead display names/search tags.
7. Entity router.
8. Telegram wiring.
9. Web Assistant wiring.
10. Calendar/future actions UI.
11. Native lead search.
12. Telegram UX polish.
13. Lead card context UI.
14. End-to-end tests.
15. Version and PR.

## Self-Review

- Spec coverage: All requested areas are represented: settings prompt/model, orchestrator-first architecture, specialized extractor, facts/events/follow-ups/people/organizations/tags, calendar future actions, lead naming, search, Telegram, Web Assistant, history/context UI.
- Placeholder scan: No `TBD` or `TODO` placeholders remain.
- Type consistency: The plan uses `crm_entity_extractor`, `CrmEntityExtraction`, `LeadContextEntity`, and `CrmCalendarAction` consistently across DB, assistant, web, and Telegram.
- Scope: This is a large but coherent epic. If it becomes too big during execution, split after Task 7 into PR 1 and continue Tasks 8-15 as PR 2 stacked on the first branch.
