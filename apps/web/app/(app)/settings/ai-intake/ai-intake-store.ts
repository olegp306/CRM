import {
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
  CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
  CRM_ORCHESTRATOR_DEFAULT_MODEL,
  CRM_ORCHESTRATOR_DEFAULT_PROMPT,
  createDefaultClientMaterialAnalysisSetting,
  createDefaultCrmOrchestratorSetting,
  createWorkspaceAiSettingPrismaStore,
  prisma,
  type UpsertClientMaterialAnalysisSettingInput,
  type UpsertCrmOrchestratorSettingInput,
  type WorkspaceAiSettingRecord,
  type WorkspaceAiSettingStore
} from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../../lib/database-runtime";

type GlobalAiIntakeStore = typeof globalThis & {
  workspaceAiSettings?: WorkspaceAiSettingRecord[];
  workspaceAiSettingPrismaStore?: WorkspaceAiSettingStore;
};

const globalForAiIntake = globalThis as GlobalAiIntakeStore;

export const CLIENT_MATERIAL_ANALYSIS_MODEL_OPTIONS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5", label: "GPT-5" },
  { id: "gpt-5.1", label: "GPT-5.1" },
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 pro" }
] as const;

export const CRM_ORCHESTRATOR_MODEL_OPTIONS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-5", label: "GPT-5" },
  { id: "gpt-5.1", label: "GPT-5.1" },
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 pro" }
] as const;

function getMemorySettings(): WorkspaceAiSettingRecord[] {
  if (!globalForAiIntake.workspaceAiSettings) {
    globalForAiIntake.workspaceAiSettings = [];
  }

  return globalForAiIntake.workspaceAiSettings;
}

export function createMemoryWorkspaceAiSettingStore(settings = getMemorySettings()): WorkspaceAiSettingStore {
  return {
    async getClientMaterialAnalysis(workspaceId) {
      return (
        settings.find((setting) => setting.workspaceId === workspaceId && setting.role === "client_material_analysis") ??
        createDefaultClientMaterialAnalysisSetting(workspaceId)
      );
    },

    async upsertClientMaterialAnalysis(input: UpsertClientMaterialAnalysisSettingInput) {
      const existingIndex = settings.findIndex(
        (setting) => setting.workspaceId === input.workspaceId && setting.role === "client_material_analysis"
      );
      const record: WorkspaceAiSettingRecord = {
        workspaceId: input.workspaceId,
        role: "client_material_analysis",
        model: input.model || CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
        prompt: input.prompt || CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
        updatedAt: new Date()
      };

      if (existingIndex >= 0) {
        settings[existingIndex] = record;
      } else {
        settings.push(record);
      }

      return record;
    },

    async getCrmOrchestrator(workspaceId) {
      return (
        settings.find((setting) => setting.workspaceId === workspaceId && setting.role === "crm_orchestrator") ??
        createDefaultCrmOrchestratorSetting(workspaceId)
      );
    },

    async upsertCrmOrchestrator(input: UpsertCrmOrchestratorSettingInput) {
      const existingIndex = settings.findIndex((setting) => setting.workspaceId === input.workspaceId && setting.role === "crm_orchestrator");
      const record: WorkspaceAiSettingRecord = {
        workspaceId: input.workspaceId,
        role: "crm_orchestrator",
        model: input.model || CRM_ORCHESTRATOR_DEFAULT_MODEL,
        prompt: input.prompt || CRM_ORCHESTRATOR_DEFAULT_PROMPT,
        updatedAt: new Date()
      };

      if (existingIndex >= 0) {
        settings[existingIndex] = record;
      } else {
        settings.push(record);
      }

      return record;
    }
  };
}

export function selectWorkspaceAiSettingStoreRuntime<TStore>({
  databaseUrl,
  nodeEnv,
  memoryStore,
  prismaStore
}: {
  databaseUrl?: string;
  nodeEnv?: string;
  memoryStore: TStore;
  prismaStore: TStore;
}): TStore {
  return selectDatabaseBackedRuntime({
    databaseUrl,
    nodeEnv,
    memoryRuntime: memoryStore,
    databaseRuntime: prismaStore,
    runtimeName: "workspace AI setting store"
  });
}

function getWorkspaceAiSettingStore(): WorkspaceAiSettingStore {
  const memoryStore = createMemoryWorkspaceAiSettingStore();

  if (!globalForAiIntake.workspaceAiSettingPrismaStore) {
    globalForAiIntake.workspaceAiSettingPrismaStore = createWorkspaceAiSettingPrismaStore(prisma as never);
  }

  return selectWorkspaceAiSettingStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore,
    prismaStore: globalForAiIntake.workspaceAiSettingPrismaStore
  });
}

export async function getClientMaterialAnalysisSetting(workspaceId: string): Promise<WorkspaceAiSettingRecord> {
  return getWorkspaceAiSettingStore().getClientMaterialAnalysis(workspaceId);
}

export async function saveClientMaterialAnalysisSetting(
  input: UpsertClientMaterialAnalysisSettingInput
): Promise<WorkspaceAiSettingRecord> {
  return getWorkspaceAiSettingStore().upsertClientMaterialAnalysis(input);
}

export async function getCrmOrchestratorSetting(workspaceId: string): Promise<WorkspaceAiSettingRecord> {
  return getWorkspaceAiSettingStore().getCrmOrchestrator(workspaceId);
}

export async function saveCrmOrchestratorSetting(input: UpsertCrmOrchestratorSettingInput): Promise<WorkspaceAiSettingRecord> {
  return getWorkspaceAiSettingStore().upsertCrmOrchestrator(input);
}
