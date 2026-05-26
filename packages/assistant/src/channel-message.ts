export type AssistantChannel = "web" | "telegram";

export type AssistantChannelAttachment = {
  id: string;
  kind: "photo" | "pdf" | "docx" | "text" | "other";
  fileName: string;
  mimeType: string;
  base64?: string;
  storageKey?: string;
  sourceUrl?: string;
};

export type AssistantChannelReplyContext = {
  sourceChannel: AssistantChannel;
  sourceMessageId: string;
  leadId?: string;
};

export type AssistantChannelContext = {
  workspaceId: string;
  userId: string;
  role: string;
  route?: string;
  module?: string;
  selectedRecordIds?: string[];
};

export type AssistantChannelMessage = {
  channel: AssistantChannel;
  threadId: string;
  messageId: string;
  content: string;
  receivedAt: string;
  context: AssistantChannelContext;
  attachments: AssistantChannelAttachment[];
  replyTo?: AssistantChannelReplyContext;
};

export type AssistantChannelResponseButton = {
  label: string;
  url?: string;
  action?:
    | "confirm"
    | "cancel"
    | "open_upload"
    | "open_lead"
    | "open_crm"
    | "open_pdf"
    | "download_doc"
    | "set_theme"
    | "send_kp"
    | "mark_kp_sent"
    | "undo_kp_sent";
  value?: string;
};

export type AssistantChannelResponse = {
  text: string;
  intent:
    | "help"
    | "capability_request"
    | "lead_intake"
    | "lead_update"
    | "crm_action"
    | "support_request"
    | "bug_report"
    | "feature_request"
    | "ux_feedback"
    | "business_process_note"
    | "other";
  feedbackType?: "support_request" | "bug_report" | "feature_request" | "ux_feedback" | "permission_blocked";
  buttons: AssistantChannelResponseButton[];
  normalizedActions?: Array<
    "open_crm" | "open_pdf" | "download_doc" | "send_kp" | "mark_kp_sent" | "undo_kp_sent"
  >;
  shouldPersistFeedback: boolean;
};
