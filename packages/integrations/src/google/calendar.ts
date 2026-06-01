import type { GoogleIntegrationAccount } from "./types";

export type CalendarSyncRequest = {
  workspaceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string;
};

export type CalendarSyncResult =
  | {
      status: "synced";
      googleEventId: string;
    }
  | {
      status: "skipped";
      reason: "not_configured";
    };

export type GoogleCalendarClient = {
  createEvent(account: GoogleIntegrationAccount, request: CalendarSyncRequest): Promise<{ googleEventId: string }>;
};

export async function syncEventToGoogleCalendar(
  request: CalendarSyncRequest,
  options: { account?: GoogleIntegrationAccount | null; client?: GoogleCalendarClient | null } = {}
): Promise<CalendarSyncResult> {
  if (!options.account || !options.client) {
    return { status: "skipped", reason: "not_configured" };
  }

  const event = await options.client.createEvent(options.account, request);
  return { status: "synced", googleEventId: event.googleEventId };
}
