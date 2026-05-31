import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
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
});
