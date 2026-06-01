import { describe, expect, it, vi } from "vitest";
import { syncEventToGoogleCalendar } from "./calendar";

const request = {
  workspaceId: "workspace-demo",
  title: "Follow up L-2026-002",
  startsAt: new Date("2026-05-21T09:00:00.000Z"),
  endsAt: new Date("2026-05-21T09:30:00.000Z"),
  description: "Reminder scheduled from Telegram"
};

describe("Google Calendar sync boundary", () => {
  it("skips cleanly when no Google Calendar account is connected", async () => {
    await expect(syncEventToGoogleCalendar(request)).resolves.toEqual({
      status: "skipped",
      reason: "not_configured"
    });
  });

  it("uses an injected calendar client when an account is connected", async () => {
    const createEvent = vi.fn(async () => ({ googleEventId: "google-event-1" }));

    await expect(
      syncEventToGoogleCalendar(request, {
        account: {
          workspaceId: "workspace-demo",
          connectedByUserId: "google:user@example.com",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresAt: new Date("2026-05-22T09:00:00.000Z")
        },
        client: { createEvent }
      })
    ).resolves.toEqual({
      status: "synced",
      googleEventId: "google-event-1"
    });
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "workspace-demo" }), request);
  });
});
