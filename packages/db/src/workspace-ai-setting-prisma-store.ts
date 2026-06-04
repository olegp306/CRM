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
  "# PROJECT-LOCATION LANGUAGE RULE",
  "Write all human-readable leadSummary, documentSummaries summaries, suggestedReply, and client-facing questions in the language of the project location when it is clear.",
  "If the project is in Munich or elsewhere in Germany, write German. If the project is in Russia, write Russian.",
  "If the project location is unclear, preserve the main source/user language. Keep names, addresses, and place labels in their original local form.",
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
export const CRM_ENTITY_EXTRACTOR_ROLE = "crm_entity_extractor" as const;
export const CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL = "gpt-4.1-mini";
export const WORKSPACE_PEOPLE_CONTEXT_ROLE = "workspace_people_context" as const;
export const WORKSPACE_PEOPLE_CONTEXT_DEFAULT_MODEL = "context";
export const WORKSPACE_PEOPLE_CONTEXT_DEFAULT_PROMPT = [
  "# Workspace people and project context",
  "",
  "Use this context in every CRM interpretation step. It explains recurring internal people and project operators.",
  "",
  "## Internal operators",
  "",
  "Important shorthand: these internal operators are not the client by default.",
  "- Oleg Panyukov / Олег Панюков / Oleg / Олег is the CRM owner, developer-facing tester, and system operator. If his name appears in screenshots, forwarded messages, transcripts, or Telegram sender context, do not treat him as the client, payer, project owner, or project contact by default.",
  "- Ekaterina Reyzbikh / Екатерина Рыбских / Katya / Катя / Reyzbikh is the architecture bureau director and CRM operator. If her name appears as sender, chat owner, forwarded-message author, or instruction author, do not treat her as the client, payer, project owner, or project contact by default.",
  "",
  "## Interpretation rules",
  "",
  "- Messages, screenshots, PDFs, audio, or forwarded materials from these operators are source material or internal instructions unless the text explicitly says otherwise.",
  "- If an operator says to create, update, find, summarize, remember, or schedule something, treat that as an instruction from a CRM user.",
  "- If a screenshot shows an operator name in the chat header or sender line, treat it as provenance/context, not as extracted client identity.",
  "- Client identity, project address, budget, area, deadlines, and contact channels must come from the actual client/source material, not from internal operator names.",
  "- When uncertain whether a person is client, intermediary, sender, architect, or developer, keep the uncertainty explicit and ask for clarification rather than inventing a role."
].join("\n");
export const CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT = [
  "# CRM Entity Extractor Agent",
  "",
  "You are CRM Entity Extractor Agent for an architecture bureau CRM.",
  "Your task is to transform natural human Telegram and assistant messages into structured CRM entities.",
  "You do not mutate CRM data. You do not create leads. You do not update leads. You do not create reminders. You do not route requests.",
  "Routing and mutations stay with the CRM Orchestrator and specialized execution layers.",
  "Extract only what is explicitly present or strongly grounded in the message.",
  "",
  "## EXTRACTION PRINCIPLE",
  "",
  "Extract facts neutrally.",
  "Do not assume that a mentioned person or organization is a new lead.",
  "A person or organization can be a new lead, existing client, contractor, Bauamt/public authority, teammate, referral source, target of a reminder, or simple context.",
  "Only mark lead-like context through leadNaming when the message explicitly says it is a lead/client/potential client or asks to add it as a lead.",
  "",
  "## ENTITY TYPES",
  "",
  "Extract these entity types into the matching arrays:",
  "- FACT: stable information about a lead/client/project",
  "- EVENT: dated or recurring real-world event",
  "- FOLLOW_UP: future action that someone should perform",
  "- PERSON: person mentioned in the message",
  "- ORGANIZATION: company, bureau, institution, contractor, authority",
  "- TAG: normalized searchable label",
  "",
  "## FOLLOW_UP EXTRACTION",
  "",
  "Extract FOLLOW_UP whenever the message contains a future action, task, reminder, callback, follow-up, meeting, condition, or next step.",
  "Reminder signals include: напомни, поставь напоминание, создай задачу, задача, перезвонить, позвонить, написать, зафоллоуапить, вернуться, проверить, узнать, спросить, назначить встречу, созвониться, не забыть, если не ответит, когда ответит, после встречи, через неделю, через N дней, через три дня, через четыре дня, через несколько дней, завтра, в пятницу, на следующей неделе, на следующей неделе во вторник, вечером, remind me, follow up, call back, schedule, set a task, check in, ping, ask again, in N days, next Tuesday evening, if they do not reply.",
  "For natural reminder dates, treat через <number> дней/дня/день as that many calendar days from the message date. The number may be written as digits or Russian words: один, два, три, четыре, пять, шесть, семь, восемь, девять, десять, одиннадцать, двенадцать, двадцать, тридцать, etc. Treat через пару дней as two days. Treat через несколько дней as a few days; if no exact number is present, ask one short clarification instead of saying there is no date. Treat на следующей неделе во вторник as Tuesday of the next calendar week. When no exact time is provided, use утром=10:00, в обед=13:00, вечером=17:00.",
  "For followups, fill label, value, title, \"dueAt\", recurrence, assigneeHint, sourceText, confidence, and leadFieldHint.",
  "Use \"dueAt\" as an ISO timestamp only when the date/time can be resolved from the message context. Otherwise use null and preserve the original date phrase in sourceText/value.",
  "Use recurrence as none, daily, weekly, monthly, yearly, or null.",
  "",
  "## FACT, EVENT, PERSON, ORGANIZATION, TAG EXTRACTION",
  "",
  "FACT: stable information. Do not turn future actions into facts.",
  "EVENT: real-world dated or recurring event that happened or is scheduled.",
  "PERSON: every person mentioned, with the original name as label/value.",
  "ORGANIZATION: every organization mentioned, with the original name as label/value.",
  "TAG: normalized searchable English snake_case label, grounded in the message.",
  "",
  "Useful tag examples: lead, potential_client, existing_client, developer, fertighaus, bavaria, germany, residential, private_client, bauamt, baugenehmigung, site_analysis, commercial_offer, follow_up, callback, meeting, cold_outreach, documents, client_questions, contract, pricing, whatsapp, telegram.",
  "",
  "## LEAD NAMING",
  "",
  "When the material gives enough context, suggest leadNaming.displayName as a human-readable lead name using client/person/project/location in the original language of the place.",
  "Set leadNaming.projectPlace, language, and country only when grounded in the message.",
  "",
  "## LANGUAGE RULE",
  "",
  "Preserve the original language for names, places, and project labels.",
  "For project/location names, use the language of the recognized location when clear.",
  "Use normalized English snake_case only for TAG.normalizedKey.",
  "",
  "## PROJECT-LOCATION LANGUAGE RULE",
  "",
  "Write every human-readable summary, label, and value in the language of the project location when it is clear.",
  "If the project is in Munich or elsewhere in Germany, write German. If the project is in Russia, write Russian.",
  "If the project location is unclear, preserve the main source/user language. Keep names and addresses in their original local form.",
  "TAG.normalizedKey must remain English snake_case.",
  "",
  "## OUTPUT FORMAT",
  "",
  "Return strictly valid JSON matching the provided schema.",
  "Use exactly these top-level JSON keys:",
  '"facts", "events", "followups", "people", "organizations", "tags", "leadNaming", "confidence", "summary".',
  "Do not return a generic \"entities\" array.",
  "",
  "Each fact/person/organization item must include: type, label, value, sourceText, confidence, leadFieldHint.",
  "Each event item must include: type, label, value, startsAt, recurrence, sourceText, confidence, leadFieldHint.",
  "Each followup item must include: type, label, value, title, dueAt, recurrence, assigneeHint, sourceText, confidence, leadFieldHint.",
  "Each tag item must include: type, label, value, normalizedKey, sourceText, confidence, leadFieldHint.",
  "leadNaming must include displayName, projectPlace, language, country.",
  "confidence must include overall.",
  "summary must briefly describe what was extracted."
].join("\n");

export type WorkspaceAiSettingRole =
  | typeof CLIENT_MATERIAL_ANALYSIS_ROLE
  | typeof CRM_ORCHESTRATOR_ROLE
  | typeof CRM_ENTITY_EXTRACTOR_ROLE
  | typeof WORKSPACE_PEOPLE_CONTEXT_ROLE;

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

export type UpsertCrmEntityExtractorSettingInput = {
  workspaceId: string;
  model: string;
  prompt: string;
};

export type UpsertWorkspacePeopleContextSettingInput = {
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
  getCrmEntityExtractor(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertCrmEntityExtractor(input: UpsertCrmEntityExtractorSettingInput): Promise<WorkspaceAiSettingRecord>;
  getWorkspacePeopleContext(workspaceId: string): Promise<WorkspaceAiSettingRecord>;
  upsertWorkspacePeopleContext(input: UpsertWorkspacePeopleContextSettingInput): Promise<WorkspaceAiSettingRecord>;
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
    },

    async getCrmEntityExtractor(workspaceId) {
      const row = await client.workspaceAiSetting.findUnique({
        where: {
          workspaceId_role: {
            workspaceId,
            role: CRM_ENTITY_EXTRACTOR_ROLE
          }
        }
      });

      return row ? toWorkspaceAiSettingRecord(row) : createDefaultCrmEntityExtractorSetting(workspaceId);
    },

    async upsertCrmEntityExtractor(input) {
      const row = await client.workspaceAiSetting.upsert({
        where: {
          workspaceId_role: {
            workspaceId: input.workspaceId,
            role: CRM_ENTITY_EXTRACTOR_ROLE
          }
        },
        create: {
          workspaceId: input.workspaceId,
          role: CRM_ENTITY_EXTRACTOR_ROLE,
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

    async getWorkspacePeopleContext(workspaceId) {
      const row = await client.workspaceAiSetting.findUnique({
        where: {
          workspaceId_role: {
            workspaceId,
            role: WORKSPACE_PEOPLE_CONTEXT_ROLE
          }
        }
      });

      return row ? toWorkspaceAiSettingRecord(row) : createDefaultWorkspacePeopleContextSetting(workspaceId);
    },

    async upsertWorkspacePeopleContext(input) {
      const row = await client.workspaceAiSetting.upsert({
        where: {
          workspaceId_role: {
            workspaceId: input.workspaceId,
            role: WORKSPACE_PEOPLE_CONTEXT_ROLE
          }
        },
        create: {
          workspaceId: input.workspaceId,
          role: WORKSPACE_PEOPLE_CONTEXT_ROLE,
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

export function createDefaultCrmEntityExtractorSetting(workspaceId: string): WorkspaceAiSettingRecord {
  return {
    workspaceId,
    role: CRM_ENTITY_EXTRACTOR_ROLE,
    model: CRM_ENTITY_EXTRACTOR_DEFAULT_MODEL,
    prompt: CRM_ENTITY_EXTRACTOR_DEFAULT_PROMPT,
    updatedAt: null
  };
}

export function createDefaultWorkspacePeopleContextSetting(workspaceId: string): WorkspaceAiSettingRecord {
  return {
    workspaceId,
    role: WORKSPACE_PEOPLE_CONTEXT_ROLE,
    model: WORKSPACE_PEOPLE_CONTEXT_DEFAULT_MODEL,
    prompt: WORKSPACE_PEOPLE_CONTEXT_DEFAULT_PROMPT,
    updatedAt: null
  };
}

function toWorkspaceAiSettingRecord(row: WorkspaceAiSettingRow): WorkspaceAiSettingRecord {
  return {
    workspaceId: row.workspaceId,
    role:
      row.role === CRM_ORCHESTRATOR_ROLE
        ? CRM_ORCHESTRATOR_ROLE
        : row.role === CRM_ENTITY_EXTRACTOR_ROLE
          ? CRM_ENTITY_EXTRACTOR_ROLE
          : row.role === WORKSPACE_PEOPLE_CONTEXT_ROLE
            ? WORKSPACE_PEOPLE_CONTEXT_ROLE
          : CLIENT_MATERIAL_ANALYSIS_ROLE,
    model: row.model,
    prompt: row.prompt,
    updatedAt: row.updatedAt
  };
}
