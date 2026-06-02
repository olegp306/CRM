import { describe, expect, it } from "vitest";
import {
  createLeadSearchCrmResultsUrl,
  createLeadSearchFilterSubmissionResult,
  createLeadSearchFilterResponse,
  filterLeadSearchRecords,
  parseLeadSearchFilterRequest,
  type LeadSearchRecord
} from "./lead-search-filter-agent";

const records: LeadSearchRecord[] = [
  {
    id: "lead-1",
    leadId: "L-2026-001",
    createdDate: "2026-05-15T10:00:00.000Z",
    status: "new",
    temperature: "warm",
    requestType: "Self storage feasibility",
    projectAddress: "Bayern",
    clientName: "Katia Reyzbikh"
  },
  {
    id: "lead-2",
    leadId: "L-2026-002",
    createdDate: "2026-06-01T10:00:00.000Z",
    status: "needs_data",
    temperature: "hot",
    requestType: "EFH Neubau",
    projectAddress: "Munich",
    clientName: "Anna Meyer"
  },
  {
    id: "lead-3",
    leadId: "L-2026-003",
    createdDate: "2026-05-20T10:00:00.000Z",
    status: "new",
    temperature: "cold",
    requestType: "Office renovation",
    projectAddress: "Berlin",
    clientName: "Buro GmbH",
    displayName: "Buro GmbH - Office renovation in Berlin",
    searchTags: ["office_renovation", "berlin", "hobby_jazz"]
  }
];

describe("lead search/filter agent", () => {
  it("parses last-month warm lead list requests", () => {
    const request = parseLeadSearchFilterRequest("Покажи всех warm лидов за прошлый месяц", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request).toMatchObject({
      kind: "leads",
      wantsCsv: false,
      filters: {
        temperature: "warm",
        datePreset: "last_month"
      }
    });
  });

  it("parses CSV export requests as lead search with CSV output", () => {
    const request = parseLeadSearchFilterRequest("Send me CSV export of leads from last month", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request).toMatchObject({
      kind: "leads",
      wantsCsv: true,
      filters: {
        datePreset: "last_month"
      }
    });
  });

  it("filters leads by temperature and date preset", () => {
    const request = parseLeadSearchFilterRequest("Покажи всех warm лидов за прошлый месяц", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(filterLeadSearchRecords(records, request)).toEqual([records[0]]);
  });

  it("filters leads by display names and normalized search tags", () => {
    const request = parseLeadSearchFilterRequest("Find leads tagged hobby_jazz", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request.filters.query).toBe("hobby_jazz");
    expect(filterLeadSearchRecords(records, request)).toEqual([records[2]]);
  });

  it("finds leads by human title fragments instead of exact full names", () => {
    const titleLead: LeadSearchRecord = {
      id: "lead-5",
      leadId: "L-2026-005",
      createdDate: "2026-06-03T10:00:00.000Z",
      status: "new",
      displayName: "Frau Schneider - Neubau EFH am Chiemsee",
      requestType: "Neubau Einfamilienhaus",
      projectAddress: "Bad Aibling",
      searchTags: ["schneider", "chiemsee", "efh", "haus", "lake"]
    };
    const request = parseLeadSearchFilterRequest("Find lead Schneider house lake", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request.filters.query).toBe("Schneider house lake");
    expect(filterLeadSearchRecords([...records, titleLead], request)).toEqual([titleLead]);
  });

  it("filters leads by multilingual lead names from Telegram-style search", () => {
    const russianLead: LeadSearchRecord = {
      id: "lead-4",
      leadId: "L-2026-004",
      createdDate: "2026-06-02T10:00:00.000Z",
      status: "new",
      displayName: "Ирина Шнайдер - консультация по реконструкции в Сочи",
      searchTags: ["ирина_шнаидер", "консультация_по_реконструкции", "сочи", "russia"]
    };
    const request = parseLeadSearchFilterRequest("Найди лид Ирина Шнайдер", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request.filters.query).toBe("Ирина Шнайдер");
    expect(filterLeadSearchRecords([...records, russianLead], request)).toEqual([russianLead]);
  });

  it("parses latest lead list requests with a result limit", () => {
    const request = parseLeadSearchFilterRequest("Покажи последние 10 лидов", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(request.limit).toBe(10);
    expect(request.filters).toMatchObject({ datePreset: null });
  });

  it("returns a compact lead list and a CSV action when requested", () => {
    const response = createLeadSearchFilterResponse("Send me CSV export of leads from last month", records, {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(response.intent).toBe("support_request");
    expect(response.text).toContain("Found 2 leads");
    expect(response.text).toContain("L-2026-001");
    expect(response.text).toContain("L-2026-003");
    expect(response.buttons).toEqual([{ label: "Download CSV", action: "download_csv", url: "/exports/leads?date=last_month" }]);
  });

  it("returns CRM buttons for visible search results when requested", () => {
    const response = createLeadSearchFilterResponse("Find leads tagged hobby_jazz", records, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      includeCrmButtons: true
    });

    expect(response.text).toContain("Found 1 leads");
    expect(response.buttons).toEqual([
      { label: "L-2026-003 · Buro GmbH - Office renovation...", action: "open_crm", url: "/leads?leadId=L-2026-003" },
      { label: "Open results in CRM", action: "open_crm", url: "/leads?leadSearch=hobby_jazz" }
    ]);
  });

  it("formats CRM buttons with a short lead title for Telegram selection", () => {
    const response = createLeadSearchFilterResponse(
      "Find lead Schneider house lake",
      [
        {
          id: "lead-5",
          leadId: "L-2026-005",
          createdDate: "2026-06-03T10:00:00.000Z",
          status: "new",
          displayName: "Frau Schneider - Neubau EFH am Chiemsee",
          searchTags: ["schneider", "chiemsee", "efh", "haus", "lake"]
        }
      ],
      {
        includeCrmButtons: true
      }
    );

    expect(response.buttons[0]).toEqual({
      label: "L-2026-005 · Frau Schneider - Neubau EFH...",
      action: "open_crm",
      url: "/leads?leadId=L-2026-005"
    });
  });

  it("creates a CRM results URL from structured filters", () => {
    const request = parseLeadSearchFilterRequest("Send me CSV export of warm leads from last month", {
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(createLeadSearchCrmResultsUrl(request)).toBe("/leads?date=last_month&temperature=warm");
  });

  it("creates a submission result for web assistant search/filter requests without feedback or action preview", () => {
    const result = createLeadSearchFilterSubmissionResult(
      {
        context: {
          workspaceId: "workspace-demo",
          userId: "user-demo",
          role: "admin",
          route: "/assistant",
          module: "assistant",
          selectedRecordIds: []
        },
        content: "Send me CSV export of warm leads from last month",
        threadId: "thread-search",
        messageId: "message-search",
        attachments: []
      },
      records,
      {
        now: new Date("2026-06-10T12:00:00.000Z")
      }
    );

    expect(result.response).toContain("Found 1 leads");
    expect(result.response).toContain("L-2026-001");
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
    expect(result.responseButtons).toEqual([
      { label: "Download CSV", action: "download_csv", url: "/exports/leads?date=last_month&temperature=warm" }
    ]);
  });
});
