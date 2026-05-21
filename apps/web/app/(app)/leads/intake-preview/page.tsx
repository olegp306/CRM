import { classifyLeadStandardness, detectLeadMissingData, findMatchingClient, validateClientInput } from "@app/core";

const existingClients = [
  { id: "client-1", name: "Anna Beispiel", email: "anna@example.com", phone: "+49 30 123" },
  { id: "client-2", name: "Musterbau GmbH", email: "info@musterbau.example", phone: "+49 30 456" }
];

const clientInput = {
  name: " Anna Beispiel ",
  clientType: "private",
  email: "ANNA@EXAMPLE.COM",
  phone: "+49 30 123",
  language: "de"
};

const leadInput = {
  clientName: "Anna Beispiel",
  requestType: "new_build",
  projectAddress: "Beispielstrasse 1, Berlin",
  bgfM2: 150
};

const clientValidation = validateClientInput(clientInput);
const clientMatch = findMatchingClient(existingClients, clientInput);
const missingData = detectLeadMissingData(leadInput);
const standardness = classifyLeadStandardness(leadInput);

export default function LeadIntakePreviewPage() {
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Lead intake preview</h1>
        <p className="text-sm text-muted-foreground">Deterministic CRM helpers that will back assistant lead creation.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewCard title="Client validation" value={clientValidation.ok ? "Valid client input" : "Needs correction"} />
        <PreviewCard title="Client match" value={clientMatch.match ? `${clientMatch.reason}: ${clientMatch.match.name}` : "No match"} />
        <PreviewCard title="Missing data" value={missingData.length > 0 ? missingData.join(", ") : "Complete"} />
        <PreviewCard title="Standard pricing" value={standardness.isStandard ? "Standard lead" : standardness.reason} />
      </div>
    </section>
  );
}

function PreviewCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}
