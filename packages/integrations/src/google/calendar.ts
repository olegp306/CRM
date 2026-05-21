export type CalendarSyncRequest = {
  workspaceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string;
};

export async function syncEventToGoogleCalendar(request: CalendarSyncRequest): Promise<{ googleEventId: string }> {
  throw new Error(`Google Calendar sync is not connected yet for event ${request.title}`);
}
