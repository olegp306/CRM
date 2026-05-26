import type { AssistantChannelResponseButton } from "./channel-message";

export type LeadChatAction =
  | { type: "open_crm"; leadId: string; url: string }
  | { type: "open_pdf"; leadId: string; url: string }
  | { type: "download_doc"; leadId: string; url: string }
  | { type: "send_kp"; leadId: string; mailtoUrl: string }
  | { type: "mark_kp_sent"; leadId: string }
  | { type: "undo_kp_sent"; leadId: string };

export type LeadChatActionLead = {
  leadId: string;
  missingFields?: string[];
  kpReady?: boolean;
  pdfUrl?: string;
  docxUrl?: string;
  canSendKp?: boolean;
  kpSent?: boolean;
  clientEmail?: string | null;
  mailtoUrl?: string;
};

export type CreateLeadChatActionsOptions = {
  crmBaseUrl?: string;
};

export function createLeadChatActions(lead: LeadChatActionLead, options: CreateLeadChatActionsOptions = {}): LeadChatAction[] {
  const actions: LeadChatAction[] = [
    {
      type: "open_crm",
      leadId: lead.leadId,
      url: createCrmLeadUrl(lead.leadId, options.crmBaseUrl)
    }
  ];

  if (lead.pdfUrl) {
    actions.push({ type: "open_pdf", leadId: lead.leadId, url: lead.pdfUrl });
  }

  if (lead.docxUrl) {
    actions.push({ type: "download_doc", leadId: lead.leadId, url: lead.docxUrl });
  }

  const missingFields = lead.missingFields ?? [];
  const kpReady = lead.kpReady === true && missingFields.length === 0;

  if (kpReady && lead.canSendKp) {
    actions.push({
      type: "send_kp",
      leadId: lead.leadId,
      mailtoUrl: lead.mailtoUrl ?? createKpMailtoUrl(lead.leadId, lead.clientEmail)
    });
  }

  if (kpReady) {
    actions.push({ type: "mark_kp_sent", leadId: lead.leadId });
  }

  if (kpReady && lead.kpSent) {
    actions.push({ type: "undo_kp_sent", leadId: lead.leadId });
  }

  return actions;
}

export function createLeadChatActionButtons(actions: LeadChatAction[]): AssistantChannelResponseButton[] {
  return actions.map((action) => {
    switch (action.type) {
      case "open_crm":
        return { label: "CRM", action: "open_crm", url: action.url };
      case "open_pdf":
        return { label: "PDF", action: "open_pdf", url: action.url };
      case "download_doc":
        return { label: "DOC", action: "download_doc", url: action.url };
      case "send_kp":
        return { label: "Send KP", action: "send_kp", url: action.mailtoUrl };
      case "mark_kp_sent":
        return { label: "Mark KP sent", action: "mark_kp_sent" };
      case "undo_kp_sent":
        return { label: "Undo", action: "undo_kp_sent" };
    }
  });
}

export function createKpMailtoUrl(leadId: string, clientEmail?: string | null): string {
  const recipient = clientEmail?.trim() ?? "";
  return `mailto:${recipient}?subject=${encodeURIComponent(`KP ${leadId}`)}`;
}

function createCrmLeadUrl(leadId: string, crmBaseUrl?: string): string {
  const path = `/leads?leadId=${encodeURIComponent(leadId)}`;
  const base = crmBaseUrl?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
