import { describe, expect, it } from "vitest";
import {
  createClientListViewModel,
  createLeadListViewModel,
  createProjectListViewModel,
  getCrmEmptyStateMessage
} from "./crm-list-store";

describe("CRM list view models", () => {
  it("maps client records into visible rows", () => {
    expect(
      createClientListViewModel([
        {
          id: "client-record-1",
          clientId: "C-2026-001",
          name: "Anna Beispiel",
          clientType: "private",
          email: "anna@example.com",
          phone: "+49 30 000000",
          status: "active",
          source: "referral"
        }
      ])
    ).toEqual([
      {
        id: "client-record-1",
        primary: "Anna Beispiel",
        secondary: "C-2026-001 · private · active",
        detail: "anna@example.com · +49 30 000000",
        meta: "referral"
      }
    ]);
  });

  it("returns explicit empty messages after a completed empty lookup", () => {
    expect(getCrmEmptyStateMessage("clients")).toBe("No clients found yet.");
    expect(getCrmEmptyStateMessage("leads")).toBe("No leads found yet.");
    expect(getCrmEmptyStateMessage("projects")).toBe("No projects found yet.");
  });

  it("maps lead and project records into visible rows", () => {
    expect(
      createLeadListViewModel([
        {
          id: "lead-record-1",
          leadId: "L-2026-001",
          requestType: "new_build",
          status: "new",
          projectAddress: "Beispielstrasse 1, Berlin",
          rawInput: "Client asks for pricing."
        }
      ])
    ).toEqual([
      {
        id: "lead-record-1",
        primary: "L-2026-001",
        secondary: "new_build · new",
        detail: "Beispielstrasse 1, Berlin",
        meta: "Client asks for pricing."
      }
    ]);

    expect(
      createProjectListViewModel([
        {
          id: "project-record-1",
          projectId: "P-2026-001",
          projectName: "Beispielstrasse New Build",
          projectType: "new_build",
          status: "active",
          currentPhase: "Negotiations",
          projectAddress: "Beispielstrasse 1, Berlin"
        }
      ])
    ).toEqual([
      {
        id: "project-record-1",
        primary: "Beispielstrasse New Build",
        secondary: "P-2026-001 · new_build · active",
        detail: "Beispielstrasse 1, Berlin",
        meta: "Negotiations"
      }
    ]);
  });
});
