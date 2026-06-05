import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
  CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL,
  CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT,
  CRM_ORCHESTRATOR_DEFAULT_MODEL,
  CRM_ORCHESTRATOR_DEFAULT_PROMPT,
  TELEGRAM_RUNTIME_DEFAULT_MODEL,
  TELEGRAM_RUNTIME_DEFAULT_PROMPT,
  WORKSPACE_PEOPLE_CONTEXT_DEFAULT_MODEL,
  WORKSPACE_PEOPLE_CONTEXT_DEFAULT_PROMPT,
  createTelegramRuntimePrompt,
  createWorkspaceAiSettingPrismaStore,
  parseTelegramRuntimeConfig
} from "./workspace-ai-setting-prisma-store";

describe("workspace ai setting prisma store", () => {
  it("returns the built-in client material analysis defaults when no row exists", async () => {
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn()
      }
    });

    const setting = await store.getClientMaterialAnalysis("workspace-demo");

    expect(setting).toEqual({
      workspaceId: "workspace-demo",
      role: "client_material_analysis",
      model: CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
      prompt: CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
      updatedAt: null
    });
    expect(setting.prompt).toContain("Reyzbikh Architekten");
    expect(setting.prompt).toContain("clientName");
    expect(setting.prompt).toContain("projectAddress");
    expect(setting.prompt).toContain("bgfM2");
    expect(setting.prompt).toContain("documentSummaries");
    expect(setting.prompt).toContain("PROJECT-LOCATION LANGUAGE RULE");
    expect(setting.prompt).toContain("Munich");
    expect(setting.prompt).toContain("German");
    expect(setting.prompt).toContain("Russia");
    expect(setting.prompt).toContain("Russian");
    expect(setting.prompt).toContain("Return strictly valid JSON");
    expect(setting.prompt).toContain("Do not invent missing fields");
    expect(setting.prompt).toContain("TELEGRAM UNDO RESPONSE PHRASES");
    expect(setting.prompt).toContain("undo successful and logged");
  });

  it("upserts the client material analysis prompt and model for one workspace", async () => {
    const upsert = vi.fn(async (args: unknown) => ({
      id: "setting-1",
      workspaceId: "workspace-demo",
      role: "client_material_analysis",
      model: "gpt-4.1",
      prompt: "Read all source material as an architecture bureau assistant.",
      createdAt: new Date("2026-05-31T08:00:00.000Z"),
      updatedAt: new Date("2026-05-31T08:05:00.000Z")
    }));
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(),
        upsert
      }
    });

    const setting = await store.upsertClientMaterialAnalysis({
      workspaceId: "workspace-demo",
      model: "gpt-4.1",
      prompt: "Read all source material as an architecture bureau assistant."
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_role: {
          workspaceId: "workspace-demo",
          role: "client_material_analysis"
        }
      },
      create: {
        workspaceId: "workspace-demo",
        role: "client_material_analysis",
        model: "gpt-4.1",
        prompt: "Read all source material as an architecture bureau assistant."
      },
      update: {
        model: "gpt-4.1",
        prompt: "Read all source material as an architecture bureau assistant."
      }
    });
    expect(setting.model).toBe("gpt-4.1");
    expect(setting.prompt).toContain("architecture bureau");
  });

  it("returns the built-in CRM orchestrator defaults when no row exists", async () => {
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn()
      }
    });

    const setting = await store.getCrmOrchestrator("workspace-demo");

    expect(setting).toEqual({
      workspaceId: "workspace-demo",
      role: "crm_orchestrator",
      model: CRM_ORCHESTRATOR_DEFAULT_MODEL,
      prompt: CRM_ORCHESTRATOR_DEFAULT_PROMPT,
      updatedAt: null
    });
    expect(setting.prompt).toContain("CRM Orchestrator Agent");
    expect(setting.prompt).toContain("Lead Creation Agent");
    expect(setting.prompt).toContain("Lead Update Agent");
    expect(setting.prompt).toContain("Lead Search Agent");
    expect(setting.prompt).toContain("lead display name / project title");
    expect(setting.prompt).toContain("prefer SEARCH_LEAD over SUPPORT_REQUEST");
    expect(setting.prompt).toContain("field-level instructions");
    expect(setting.prompt).toContain("take only the client phone from the screenshot");
    expect(setting.prompt).toContain("Output Format");
  });

  it("upserts the CRM orchestrator prompt and model for one workspace", async () => {
    const upsert = vi.fn(async (args: unknown) => ({
      id: "setting-2",
      workspaceId: "workspace-demo",
      role: "crm_orchestrator",
      model: "gpt-5.2",
      prompt: "Route natural language CRM requests to specialized agents.",
      createdAt: new Date("2026-05-31T08:00:00.000Z"),
      updatedAt: new Date("2026-05-31T08:05:00.000Z")
    }));
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(),
        upsert
      }
    });

    const setting = await store.upsertCrmOrchestrator({
      workspaceId: "workspace-demo",
      model: "gpt-5.2",
      prompt: "Route natural language CRM requests to specialized agents."
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_role: {
          workspaceId: "workspace-demo",
          role: "crm_orchestrator"
        }
      },
      create: {
        workspaceId: "workspace-demo",
        role: "crm_orchestrator",
        model: "gpt-5.2",
        prompt: "Route natural language CRM requests to specialized agents."
      },
      update: {
        model: "gpt-5.2",
        prompt: "Route natural language CRM requests to specialized agents."
      }
    });
    expect(setting.model).toBe("gpt-5.2");
    expect(setting.prompt).toContain("specialized agents");
  });

  it("returns the built-in CRM entity extractor defaults when no row exists", async () => {
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn()
      }
    });

    const setting = await store.getCrmEntityExtractor("workspace-demo");

    expect(setting).toEqual({
      workspaceId: "workspace-demo",
      role: "crm_entity_extractor",
      model: CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL,
      prompt: CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT,
      updatedAt: null
    });
    expect(setting.prompt).toContain("CRM Entity Extractor Agent");
    expect(setting.prompt).toContain("FACT");
    expect(setting.prompt).toContain("FOLLOW_UP");
    expect(setting.prompt).toContain("PERSON");
    expect(setting.prompt).toContain("TAG");
    expect(setting.prompt).toContain('"facts"');
    expect(setting.prompt).toContain('"followups"');
    expect(setting.prompt).toContain('"leadNaming"');
    expect(setting.prompt).toContain('"dueAt"');
    expect(setting.prompt).toContain('Do not return a generic "entities" array');
    expect(setting.prompt).toContain("PROJECT-LOCATION LANGUAGE RULE");
    expect(setting.prompt).toContain("summary, label, and value");
    expect(setting.prompt).toContain("Return strictly valid JSON");
  });

  it("upserts the CRM entity extractor prompt and model for one workspace", async () => {
    const upsert = vi.fn(async (args: unknown) => ({
      id: "setting-3",
      workspaceId: "workspace-demo",
      role: "crm_entity_extractor",
      model: "gpt-5.2",
      prompt: "Extract CRM entities from incoming lead messages and return JSON.",
      createdAt: new Date("2026-06-02T08:00:00.000Z"),
      updatedAt: new Date("2026-06-02T08:05:00.000Z")
    }));
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(),
        upsert
      }
    });

    const setting = await store.upsertCrmEntityExtractor({
      workspaceId: "workspace-demo",
      model: "gpt-5.2",
      prompt: "Extract CRM entities from incoming lead messages and return JSON."
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_role: {
          workspaceId: "workspace-demo",
          role: "crm_entity_extractor"
        }
      },
      create: {
        workspaceId: "workspace-demo",
        role: "crm_entity_extractor",
        model: "gpt-5.2",
        prompt: "Extract CRM entities from incoming lead messages and return JSON."
      },
      update: {
        model: "gpt-5.2",
        prompt: "Extract CRM entities from incoming lead messages and return JSON."
      }
    });
    expect(setting.model).toBe("gpt-5.2");
    expect(setting.role).toBe("crm_entity_extractor");
  });

  it("returns the built-in workspace people context defaults when no row exists", async () => {
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn()
      }
    });

    const setting = await store.getWorkspacePeopleContext("workspace-demo");

    expect(setting).toEqual({
      workspaceId: "workspace-demo",
      role: "workspace_people_context",
      model: WORKSPACE_PEOPLE_CONTEXT_DEFAULT_MODEL,
      prompt: WORKSPACE_PEOPLE_CONTEXT_DEFAULT_PROMPT,
      updatedAt: null
    });
    expect(setting.prompt).toContain("Oleg Panyukov");
    expect(setting.prompt).toContain("Ekaterina Reyzbikh");
    expect(setting.prompt).toContain("not the client by default");
  });

  it("upserts the workspace people context for one workspace", async () => {
    const upsert = vi.fn(async (args: unknown) => ({
      id: "setting-4",
      workspaceId: "workspace-demo",
      role: "workspace_people_context",
      model: "context",
      prompt: "Oleg is the owner. Katya is the bureau director.",
      createdAt: new Date("2026-06-04T08:00:00.000Z"),
      updatedAt: new Date("2026-06-04T08:05:00.000Z")
    }));
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(),
        upsert
      }
    });

    const setting = await store.upsertWorkspacePeopleContext({
      workspaceId: "workspace-demo",
      model: "context",
      prompt: "Oleg is the owner. Katya is the bureau director."
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_role: {
          workspaceId: "workspace-demo",
          role: "workspace_people_context"
        }
      },
      create: {
        workspaceId: "workspace-demo",
        role: "workspace_people_context",
        model: "context",
        prompt: "Oleg is the owner. Katya is the bureau director."
      },
      update: {
        model: "context",
        prompt: "Oleg is the owner. Katya is the bureau director."
      }
    });
    expect(setting.role).toBe("workspace_people_context");
  });

  it("returns the built-in Telegram runtime defaults when no row exists", async () => {
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn()
      }
    });

    const setting = await store.getTelegramRuntime("workspace-demo");

    expect(setting).toEqual({
      workspaceId: "workspace-demo",
      role: "telegram_runtime",
      model: TELEGRAM_RUNTIME_DEFAULT_MODEL,
      prompt: TELEGRAM_RUNTIME_DEFAULT_PROMPT,
      updatedAt: null
    });
    expect(parseTelegramRuntimeConfig(setting.prompt)).toEqual({ runtime: "legacy" });
  });

  it("upserts the Telegram runtime mode and model for one workspace", async () => {
    const prompt = createTelegramRuntimePrompt({ runtime: "langgraph" });
    const upsert = vi.fn(async (args: unknown) => ({
      id: "setting-5",
      workspaceId: "workspace-demo",
      role: "telegram_runtime",
      model: "gpt-5.2",
      prompt,
      createdAt: new Date("2026-06-05T08:00:00.000Z"),
      updatedAt: new Date("2026-06-05T08:05:00.000Z")
    }));
    const store = createWorkspaceAiSettingPrismaStore({
      workspaceAiSetting: {
        findUnique: vi.fn(),
        upsert
      }
    });

    const setting = await store.upsertTelegramRuntime({
      workspaceId: "workspace-demo",
      model: "gpt-5.2",
      prompt
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_role: {
          workspaceId: "workspace-demo",
          role: "telegram_runtime"
        }
      },
      create: {
        workspaceId: "workspace-demo",
        role: "telegram_runtime",
        model: "gpt-5.2",
        prompt
      },
      update: {
        model: "gpt-5.2",
        prompt
      }
    });
    expect(setting.role).toBe("telegram_runtime");
    expect(parseTelegramRuntimeConfig(setting.prompt)).toEqual({ runtime: "langgraph" });
  });
});
