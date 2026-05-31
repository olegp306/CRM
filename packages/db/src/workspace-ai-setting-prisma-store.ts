export const CLIENT_MATERIAL_ANALYSIS_ROLE = "client_material_analysis" as const;
export const CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL = "gpt-4.1-mini";
export const CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT = [
  "You are an assistant for an architecture bureau.",
  "Analyze all incoming client source material: text, email fragments, PDFs, photos, documents, and audio transcripts.",
  "Extract the structured data needed to create a commercial proposal.",
  "Return concise summaries for the whole request and for each source material.",
  "If a field is missing, include it in missingData instead of inventing it."
].join(" ");

export type WorkspaceAiSettingRole = typeof CLIENT_MATERIAL_ANALYSIS_ROLE;

type WorkspaceAiSettingRow = {
  id: string;
  workspaceId: string;
  role: string;
  model: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceAiSettingRecord = {
  workspaceId: string;
  role: WorkspaceAiSettingRole;
  model: string;
  prompt: string;
  updatedAt: Date | null;
};

export type UpsertClientMaterialAnalysisSettingInput = {
  workspaceId: string;
  model: string;
  prompt: string;
};

export type WorkspaceAiSettingPrismaClientLike = {
  workspaceAiSetting: {
    findUnique(args: unknown): Promise<WorkspaceAiSettingRow | null>;
    upsert(args: unknown): Promise<WorkspaceAiSettingRow>;
  };
};

export type WorkspaceAiSettingStore = {
  getClientMaterialAnalysis(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertClientMaterialAnalysis(input: UpsertClientMaterialAnalysisSettingInput): Promise<WorkspaceAiSettingRecord>;
};

export function createWorkspaceAiSettingPrismaStore(client: WorkspaceAiSettingPrismaClientLike): WorkspaceAiSettingStore {
  return {
    async getClientMaterialAnalysis(workspaceId) {
      const row = await client.workspaceAiSetting.findUnique({
        where: {
          workspaceId_role: {
            workspaceId,
            role: CLIENT_MATERIAL_ANALYSIS_ROLE
          }
        }
      });

      return row ? toWorkspaceAiSettingRecord(row) : createDefaultClientMaterialAnalysisSetting(workspaceId);
    },

    async upsertClientMaterialAnalysis(input) {
      const row = await client.workspaceAiSetting.upsert({
        where: {
          workspaceId_role: {
            workspaceId: input.workspaceId,
            role: CLIENT_MATERIAL_ANALYSIS_ROLE
          }
        },
        create: {
          workspaceId: input.workspaceId,
          role: CLIENT_MATERIAL_ANALYSIS_ROLE,
          model: input.model,
          prompt: input.prompt
        },
        update: {
          model: input.model,
          prompt: input.prompt
        }
      });

      return toWorkspaceAiSettingRecord(row);
    }
  };
}

export function createDefaultClientMaterialAnalysisSetting(workspaceId: string): WorkspaceAiSettingRecord {
  return {
    workspaceId,
    role: CLIENT_MATERIAL_ANALYSIS_ROLE,
    model: CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL,
    prompt: CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT,
    updatedAt: null
  };
}

function toWorkspaceAiSettingRecord(row: WorkspaceAiSettingRow): WorkspaceAiSettingRecord {
  return {
    workspaceId: row.workspaceId,
    role: CLIENT_MATERIAL_ANALYSIS_ROLE,
    model: row.model,
    prompt: row.prompt,
    updatedAt: row.updatedAt
  };
}
