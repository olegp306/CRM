import { describe, expect, it, vi } from "vitest";
import {
  createMemoryWorkspaceAiSettingStore,
  selectWorkspaceAiSettingStoreRuntime
} from "./ai-intake-store";

describe("ai intake store", () => {
  it("uses memory runtime when DATABASE_URL is not configured", async () => {
    const memoryStore = createMemoryWorkspaceAiSettingStore();
    const prismaStore = {
      getClientMaterialAnalysis: vi.fn(),
      upsertClientMaterialAnalysis: vi.fn()
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
});
