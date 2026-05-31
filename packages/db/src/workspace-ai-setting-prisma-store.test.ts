import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
  CRM_ORCHESTRATOR_DEFAULT_MODEL,
  CRM_ORCHESTRATOR_DEFAULT_PROMPT,
  createWorkspaceAiSettingPrismaStore
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
    expect(setting.prompt).toContain("Return strictly valid JSON");
    expect(setting.prompt).toContain("Do not invent missing fields");
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
    expect(setting.prompt).toContain("OUTPUT FORMAT");
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
});
