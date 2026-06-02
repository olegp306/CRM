import { describe, expect, it } from "vitest";
import { createLeadDisplayMetadata } from "./lead-display-name";

describe("lead display name", () => {
  it("uses client plus German place in original local language", () => {
    expect(
      createLeadDisplayMetadata({
        clientName: "Irina Schneider",
        projectAddress: "Gartenweg 9, Bad Aibling, Deutschland",
        requestType: "Neubau EFH"
      })
    ).toEqual({
      displayName: "Irina Schneider - Neubau EFH in Bad Aibling",
      language: "de",
      country: "Germany",
      searchTags: ["irina_schneider", "neubau_efh", "bad_aibling", "germany"]
    });
  });

  it("uses Russian place and Russian object wording for Russian projects", () => {
    expect(
      createLeadDisplayMetadata({
        clientName: "Артем",
        projectAddress: "Сочи, улица Морская 12",
        requestType: "дом 120 метров"
      }).displayName
    ).toBe("Артем - дом 120 метров в Сочи");
  });
});
