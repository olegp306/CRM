import type { CreatedLeadRecord } from "@app/assistant";

export type LeadDashboardStage = "new" | "qualifying" | "kp" | "followup";

export type LeadDashboardCard = {
  id: string;
  leadId: string;
  rawInput: string;
  status: string;
  stage: LeadDashboardStage;
  sourceLabel: string;
};

export type LeadDashboardViewModel = {
  total: number;
  newCount: number;
  kpCount: number;
  followupCount: number;
  cards: LeadDashboardCard[];
  lanes: Array<{
    id: LeadDashboardStage;
    title: string;
    description: string;
    cards: LeadDashboardCard[];
  }>;
};

const laneDefinitions: Array<{
  id: LeadDashboardStage;
  title: string;
  description: string;
}> = [
  { id: "new", title: "New intake", description: "Fresh assistant-created leads" },
  { id: "qualifying", title: "Qualifying", description: "Needs missing data or manual review" },
  { id: "kp", title: "KP draft", description: "Ready for offer generation" },
  { id: "followup", title: "Follow-up", description: "Waiting for the next client touch" }
];

export function createLeadsDashboardViewModel(leads: CreatedLeadRecord[]): LeadDashboardViewModel {
  const cards = leads.map((lead): LeadDashboardCard => {
    const stage = inferLeadStage(lead);

    return {
      id: lead.id,
      leadId: lead.leadId,
      rawInput: lead.rawInput,
      status: lead.status,
      stage,
      sourceLabel: "Assistant"
    };
  });

  return {
    total: cards.length,
    newCount: cards.filter((card) => card.stage === "new").length,
    kpCount: cards.filter((card) => card.stage === "kp").length,
    followupCount: cards.filter((card) => card.stage === "followup").length,
    cards,
    lanes: laneDefinitions.map((lane) => ({
      ...lane,
      cards: cards.filter((card) => card.stage === lane.id)
    }))
  };
}

function inferLeadStage(lead: CreatedLeadRecord): LeadDashboardStage {
  const status = lead.status.toLowerCase();
  const rawInput = lead.rawInput.toLowerCase();

  if (status.includes("follow") || rawInput.includes("follow up") || rawInput.includes("follow-up")) {
    return "followup";
  }

  if (status.includes("kp") || rawInput.includes("kp") || rawInput.includes("angebot")) {
    return "kp";
  }

  if (status.includes("missing") || rawInput.includes("missing") || rawInput.includes("manual")) {
    return "qualifying";
  }

  return "new";
}
