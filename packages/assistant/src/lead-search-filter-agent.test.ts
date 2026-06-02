import { describe, expect, it } from "vitest";
import {
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
