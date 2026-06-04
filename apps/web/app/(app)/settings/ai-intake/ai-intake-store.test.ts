import { describe, expect, it, vi } from "vitest";
import {
  createMemoryWorkspaceAiSettingStore,
  CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS,
  CRM_ORCHESTRATOR_MODEL_OPTIONS,
  selectWorkspaceAiSettingStoreRuntime
} from "./ai-intake-store";

describe("ai intake store", () => {
  it("uses memory runtime when DATABASE_URL is not configured", async () => {
    const memoryStore = createMemoryWorkspaceAiSettingStore();
    const prismaStore = {
      getClientMaterialAnalysis: vi.fn(),
      upsertClientMaterialAnalysis: vi.fn(),
      getCrmOrchestrator: vi.fn(),
      upsertCrmOrchestrator: vi.fn(),
      getCrmEntityExtractor: vi.fn(),
      upsertCrmEntityExtractor: vi.fn(),
      getWorkspacePeopleContext: vi.fn(),
      upsertWorkspacePeopleContext: vi.fn()
    };

    const store = selectWorkspaceAiSettingStoreRuntime({
      databaseUrl: "",
      nodeEnv: "test",
      memoryStore,
      prismaStore
    });

    const setting = await store.getClientMaterialAnalysis("workspace-demo");

    expect(setting.workspaceId).toBe("workspace-demo");
    expect(setting.role).toBe("client_material_analysis");
    expect(prismaStore.getClientMaterialAnalysis).not.toHaveBeenCalled();
  });

  it("persists edited prompt and model in memory runtime", async () => {
    const store = createMemoryWorkspaceAiSettingStore();

    await store.upsertClientMaterialAnalysis({
      workspaceId: "workspace-demo",
      model: "gpt-4.1",
      prompt: "Use the detailed architecture bureau prompt."
    });

    await expect(store.getClientMaterialAnalysis("workspace-demo")).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        model: "gpt-4.1",
        prompt: "Use the detailed architecture bureau prompt."
      })
    );
  });

  it("persists CRM orchestrator prompt and stronger model choices in memory runtime", async () => {
    const store = createMemoryWorkspaceAiSettingStore();

    expect(CRM_ORCHESTRATOR_MODEL_OPTIONS.map((option) => option.id)).toContain("gpt-5.2");
    expect(CRM_ORCHESTRATOR_MODEL_OPTIONS.map((option) => option.id)).toContain("gpt-5.2-pro");

    await store.upsertCrmOrchestrator({
      workspaceId: "workspace-demo",
      model: "gpt-5.2",
      prompt: "Route CRM requests through specialized agents."
    });

    await expect(store.getCrmOrchestrator("workspace-demo")).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        role: "crm_orchestrator",
        model: "gpt-5.2",
        prompt: "Route CRM requests through specialized agents."
      })
    );
  });

  it("persists CRM entity extractor prompt and stronger model choices in memory runtime", async () => {
    const store = createMemoryWorkspaceAiSettingStore();

    expect(CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => option.id)).toContain("gpt-5.2");
    expect(CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => option.id)).toContain("gpt-5.2-pro");

    await store.upsertCrmEntityExtractor({
      workspaceId: "workspace-demo",
      model: "gpt-5.2",
      prompt: "Extract facts, events, follow-ups, people, organizations, and tags."
    });

    await expect(store.getCrmEntityExtractor("workspace-demo")).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        role: "crm_entity_extractor",
        model: "gpt-5.2",
        prompt: "Extract facts, events, follow-ups, people, organizations, and tags."
      })
    );
  });

  it("persists shared AI people context in memory runtime", async () => {
    const store = createMemoryWorkspaceAiSettingStore();

    await store.upsertWorkspacePeopleContext({
      workspaceId: "workspace-demo",
      model: "context",
      prompt: "Oleg and Katya are CRM operators, not clients by default."
    });

    await expect(store.getWorkspacePeopleContext("workspace-demo")).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        role: "workspace_people_context",
        model: "context",
        prompt: "Oleg and Katya are CRM operators, not clients by default."
      })
    );
  });
});
