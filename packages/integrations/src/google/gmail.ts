export type GmailDraftRequest = {
  workspaceId: string;
  to: string;
  subject: string;
  body: string;
};

export async function createGmailDraft(request: GmailDraftRequest): Promise<{ gmailDraftId: string }> {
  throw new Error(`Gmail draft creation is not connected yet for ${request.to}`);
}
