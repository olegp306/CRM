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

  it("uses client plus service as the lead name before place fallback", () => {
    expect(
      createLeadDisplayMetadata({
        clientName: "Irina Schneider",
        projectAddress: "Gartenweg 9, München, Deutschland",
        requestType: "LP1-4 commercial proposal"
      }).displayName
    ).toBe("Irina Schneider - LP1-4 commercial proposal in München");
  });

  it("keeps multilingual search tags for name, service, and local place context", () => {
    expect(
      createLeadDisplayMetadata({
        clientName: "Ирина Шнайдер",
        projectAddress: "Сочи, улица Морская 12",
        requestType: "консультация по реконструкции"
      })
    ).toEqual({
      displayName: "Ирина Шнайдер - консультация по реконструкции в Сочи",
      language: "ru",
      country: "Russia",
      searchTags: ["ирина_шнаидер", "консультация_по_реконструкции", "сочи", "russia"]
    });
  });

  it("keeps generated lead names within 80 characters", () => {
    const metadata = createLeadDisplayMetadata({
      clientName: "Dr. Katharina Elisabeth Schneider-Mueller",
      projectAddress: "Gartenweg 9, Bad Aibling, Deutschland",
      requestType: "vollstaendige architektonische Planung LP1-4 fuer sehr grosses Einfamilienhaus"
    });

    expect(metadata.displayName?.length).toBeLessThanOrEqual(80);
    expect(metadata.displayName).toBe("Dr. Katharina Elisabeth Schneider-Mueller - vollstaendige architektonische...");
  });
});
