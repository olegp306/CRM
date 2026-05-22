import { describe, expect, it } from "vitest";
import { getTablePreferencesStorageKey, normalizeTablePreferences } from "./table-preferences";

describe("table preferences", () => {
  it("creates stable local storage keys per table", () => {
    expect(getTablePreferencesStorageKey("leads")).toBe("crm.table.leads.preferences.v1");
    expect(getTablePreferencesStorageKey("editable-clients")).toBe("crm.table.editable-clients.preferences.v1");
  });

  it("keeps only valid visibility and sizing values from storage", () => {
    expect(
      normalizeTablePreferences({
        columnVisibility: {
          leadId: true,
          rawInput: false,
          invalid: "no"
        },
        columnSizing: {
          leadId: 180,
          rawInput: Number.POSITIVE_INFINITY,
          invalid: "wide"
        }
      })
    ).toEqual({
      columnVisibility: {
        leadId: true,
        rawInput: false
      },
      columnSizing: {
        leadId: 180
      }
    });
  });
});
