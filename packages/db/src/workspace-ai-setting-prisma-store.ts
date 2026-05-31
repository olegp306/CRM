import { CRM_ORCHESTRATOR_DEFAULT_PROMPT } from "@app/assistant";

export { CRM_ORCHESTRATOR_DEFAULT_PROMPT } from "@app/assistant";

export const CLIENT_MATERIAL_ANALYSIS_ROLE = "client_material_analysis" as const;
export const CLIENT_MATERIAL_ANALYSIS_DEFAULT_MODEL = "gpt-4.1-mini";
export const CLIENT_MATERIAL_ANALYSIS_DEFAULT_PROMPT = [
  "# ROLE",
  "You work as an AI assistant for the architecture bureau Reyzbikh Architekten.",
  "Your task is to analyze incoming client materials and prepare structured data for a commercial proposal.",
  "You do not sell services. You do not invent information. You do not fill missing fields with assumptions.",
  "Your task is only to extract facts, check completeness, summarize source materials, and prepare proposal-ready structured data.",
  "",
  "# INPUT MATERIALS",
  "You may receive email text, Telegram messages, WhatsApp messages, PDFs, photos, drawings, scanned documents, and voice messages or transcripts.",
  "Information may be fragmented, arrive in several parts, or be forwarded by an intermediary.",
  "",
  "# STEP 1. IDENTIFY PARTICIPANTS",
  "Identify the client, intermediary, and sender of materials when the source material makes this clear.",
  "If confidence is low, state the uncertainty in leadSummary or documentSummaries. Do not guess.",
  "",
  "# STEP 2. ANALYZE EACH FILE",
  "For each source file, add one documentSummaries item with fileName, kind, short summary, extracted facts, and importance for the proposal.",
  "If the source is audio, include the transcript when available.",
  "",
  "# STEP 3. EXTRACT OUR CRM/KP FIELDS",
  "Extract only facts that are present in the source materials.",
  "Use these field names exactly: clientName, requestType, projectAddress, bgfM2, email, phone, budgetEur, desiredStart, desiredMoveIn, isStandard.",
  "Map external KP placeholders into our fields when possible: client_name -> clientName, project_address -> projectAddress, bgf -> bgfM2.",
  "If client address lines, project name, wohnflaeche, date, or offer_valid_until are present, mention them in leadSummary or documentSummaries for now; do not invent extra JSON keys.",
  "If a field is absent, return null for nullable schema fields and include the field name in missingData only when it is truly required for the commercial proposal.",
  "",
  "# STEP 4. BUILD PROJECT SUMMARY",
  "Write leadSummary in no more than 10 sentences.",
  "Cover what the client wants, object location, object type, area, timing, constraints, and special notes when present.",
  "",
  "# STEP 5. CHECK COMPLETENESS",
  "Build missingData from truly absent required data only.",
  "Do not ask for data already present in the materials.",
  "",
  "# STEP 6. QUESTIONS TO CLIENT",
  "Put the client-facing questions into suggestedReply as one concise message when missingData is not empty.",
  "If no fields are missing, suggestedReply should say that the data is sufficient for proposal preparation.",
  "",
  "# STEP 7. PRICING",
  "If area and price-table context are available in the source material, mention pricing-relevant facts in leadSummary.",
  "Do not calculate fees unless the relevant price table data is present in the provided material.",
  "",
  "# IMPORTANT RULES",
  "Do not invent addresses, areas, client names, deadlines, prices, or project types.",
  "Mark uncertainty explicitly.",
  "If several conflicting values are found, show all variants in leadSummary or the relevant documentSummaries item.",
  "Always indicate the source of extracted facts inside documentSummaries.",
  "",
  "# OUTPUT FORMAT",
  "Return strictly valid JSON matching the provided schema.",
  "Do not invent missing fields.",
  "Use exactly these top-level JSON keys: clientName, requestType, urgency, temperature, bgfM2, projectAddress, email, phone, budgetEur, desiredStart, desiredMoveIn, isStandard, missingData, leadSummary, documentSummaries, suggestedReply, confidence."
].join("\n");
export const CRM_ORCHESTRATOR_ROLE = "crm_orchestrator" as const;
export const CRM_ORCHESTRATOR_DEFAULT_MODEL = "gpt-4.1-mini";

export type WorkspaceAiSettingRole = typeof CLIENT_MATERIAL_ANALYSIS_ROLE | typeof CRM_ORCHESTRATOR_ROLE;

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

export type UpsertCrmOrchestratorSettingInput = {
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
  getCrmOrchestrator(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertCrmOrchestrator(input: UpsertCrmOrchestratorSettingInput): Promise<WorkspaceAiSettingRecord>;
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
    },

    async getCrmOrchestrator(workspaceId) {
      const row = await client.workspaceAiSetting.findUnique({
        where: {
          workspaceId_role: {
            workspaceId,
            role: CRM_ORCHESTRATOR_ROLE
          }
        }
      });

      return row ? toWorkspaceAiSettingRecord(row) : createDefaultCrmOrchestratorSetting(workspaceId);
    },

    async upsertCrmOrchestrator(input) {
      const row = await client.workspaceAiSetting.upsert({
        where: {
          workspaceId_role: {
            workspaceId: input.workspaceId,
            role: CRM_ORCHESTRATOR_ROLE
          }
        },
        create: {
          workspaceId: input.workspaceId,
          role: CRM_ORCHESTRATOR_ROLE,
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

export function createDefaultCrmOrchestratorSetting(workspaceId: string): WorkspaceAiSettingRecord {
  return {
    workspaceId,
    role: CRM_ORCHESTRATOR_ROLE,
    model: CRM_ORCHESTRATOR_DEFAULT_MODEL,
    prompt: CRM_ORCHESTRATOR_DEFAULT_PROMPT,
    updatedAt: null
  };
}

function toWorkspaceAiSettingRecord(row: WorkspaceAiSettingRow): WorkspaceAiSettingRecord {
  return {
    workspaceId: row.workspaceId,
    role: row.role === CRM_ORCHESTRATOR_ROLE ? CRM_ORCHESTRATOR_ROLE : CLIENT_MATERIAL_ANALYSIS_ROLE,
    model: row.model,
    prompt: row.prompt,
    updatedAt: row.updatedAt
  };
}
