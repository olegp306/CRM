import { getNextBusinessId, parseColdTargetCsv, parseHonorartabelleTsv } from "@app/core";
import { demoColdTargetsTsv, demoHonorartabelle2026Tsv } from "./demo-import-data";

export type DemoSeedData = ReturnType<typeof createDemoSeedData>;

export function createDemoSeedData(now = new Date()) {
  const clientIds: string[] = [];
  const leadIds: string[] = [];
  const projectIds: string[] = [];

  const nextClientId = () => {
    const id = getNextBusinessId({ kind: "client", now, existingIds: clientIds });
    clientIds.push(id);
    return id;
  };
  const nextLeadId = () => {
    const id = getNextBusinessId({ kind: "lead", now, existingIds: leadIds });
    leadIds.push(id);
    return id;
  };
  const nextProjectId = () => {
    const id = getNextBusinessId({ kind: "project", now, existingIds: projectIds });
    projectIds.push(id);
    return id;
  };

  const priceTablePreview = parseHonorartabelleTsv(demoHonorartabelle2026Tsv);
  const coldTargetPreview = parseColdTargetCsv(demoColdTargetsTsv);

  if (priceTablePreview.warnings.length > 0) {
    throw new Error(`Invalid demo honorar table: ${priceTablePreview.warnings.map((warning) => warning.message).join(", ")}`);
  }
  if (coldTargetPreview.warnings.length > 0) {
    throw new Error(`Invalid demo cold target table: ${coldTargetPreview.warnings.map((warning) => warning.message).join(", ")}`);
  }

  return {
    workspace: {
      id: "workspace-demo",
      name: "Demo Architecture Studio",
      brandName: "Reyzbikh architect CRM",
      primaryColor: "#1c1917"
    },
    owner: {
      id: "user-demo",
      email: "demo-admin@example.com",
      name: "Demo Owner"
    },
    priceTableRows: priceTablePreview.rows,
    coldTargets: coldTargetPreview.rows,
    clients: [
      {
        clientId: nextClientId(),
        name: "Anna Beispiel",
        clientType: "private",
        language: "de",
        email: "anna@example.com",
        phone: "+49 30 000000",
        source: "referral",
        status: "active"
      },
      {
        clientId: nextClientId(),
        name: "Musterbau GmbH",
        clientType: "company",
        language: "de",
        email: "kontakt@musterbau.example",
        phone: "+49 30 111111",
        source: "cold_outreach",
        status: "active"
      }
    ],
    leads: [
      {
        leadId: nextLeadId(),
        temperature: "warm",
        requestType: "new_build",
        urgency: "medium",
        bgfM2: "150",
        projectAddress: "Beispielstrasse 1, Berlin",
        isStandard: true,
        status: "new",
        rawInput: "Client asks for standard new build pricing around 150 BGF."
      },
      {
        leadId: nextLeadId(),
        temperature: "cold",
        requestType: "renovation",
        urgency: "low",
        projectAddress: "Altbauweg 12, Potsdam",
        isStandard: false,
        status: "needs_pricing",
        rawInput: "Complex renovation with likely manual pricing."
      }
    ],
    projects: [
      {
        projectId: nextProjectId(),
        projectName: "Beispielstrasse New Build",
        projectAddress: "Beispielstrasse 1, Berlin",
        projectType: "new_build",
        currentPhase: "Negotiations",
        status: "active"
      }
    ]
  };
}
