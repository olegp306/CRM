import { AVAILABLE_DOCUMENT_VARIABLES } from "@app/documents";
import { getWorkspaceSession } from "../../../workspace-session";
import { uploadDocumentTemplateAction } from "./actions";
import { listDocumentTemplates } from "./template-store";

export default async function TemplatesPage() {
  const session = await getWorkspaceSession();
  const templates = await listDocumentTemplates(session.workspaceId);
  const currentKpTemplateId = templates.find((template) => template.documentType === "kp" && template.isActive)?.id;

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted-foreground">Validate document placeholders before generating DOCX and PDF files.</p>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{template.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {template.documentType.toUpperCase()} · {template.language.toUpperCase()} · v{template.version ?? "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {template.id === currentKpTemplateId ? (
                  <span className="rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-white">Current</span>
                ) : null}
                <span
                  className={
                    template.validationStatus === "valid"
                      ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                      : "rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                  }
                >
                  {template.validationStatus === "valid" ? "Valid" : "Needs attention"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Detected placeholders</h3>
                <p className="mt-1 text-sm text-foreground">
                  {template.detectedPlaceholders.length > 0 ? template.detectedPlaceholders.join(", ") : "None"}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Unknown placeholders</h3>
                <p className="mt-1 text-sm text-foreground">
                  {template.unknownPlaceholders.length > 0 ? template.unknownPlaceholders.join(", ") : "None"}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <form action={uploadDocumentTemplateAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <div>
          <h2 className="text-base font-semibold">Upload template</h2>
          <p className="mt-1 text-sm text-muted-foreground">Store DOCX metadata and validate placeholder text.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Name</span>
            <input name="name" defaultValue="KP Template" className="rounded-md border border-border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Document type</span>
            <select name="documentType" defaultValue="kp" className="rounded-md border border-border px-3 py-2">
              <option value="kp">KP / Angebot</option>
              <option value="contract">Contract</option>
              <option value="invoice">Invoice</option>
              <option value="status_report">Status Report</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Language</span>
            <select name="language" defaultValue="en" className="rounded-md border border-border px-3 py-2">
              <option value="en">English</option>
              <option value="de">German</option>
              <option value="ru">Russian</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">DOCX file</span>
          <input
            name="templateFile"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="rounded-md border border-border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Placeholder text</span>
          <textarea
            name="templateText"
            defaultValue="Dear {{ client_name }}, project {{ project_address }}."
            className="min-h-24 rounded-md border border-border px-3 py-2"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Upload template
        </button>
      </form>

      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Available variables</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {AVAILABLE_DOCUMENT_VARIABLES.map((variable) => (
            <code key={variable} className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
              {variable}
            </code>
          ))}
        </div>
      </div>
    </section>
  );
}
