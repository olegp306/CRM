import { getWorkspaceSession } from "../../workspace-session";
import { listAssistantGeneratedDocuments } from "../assistant/document-execution-store";

export default async function DocumentsPage({
  searchParams
}: {
  searchParams?: Promise<{ documentId?: string }>;
}) {
  const session = await getWorkspaceSession();
  const generatedDocuments = await listAssistantGeneratedDocuments(session.workspaceId);
  const selectedDocumentId = (await searchParams)?.documentId;

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Generated KP documents, templates, and document history. Use PDF for review and Telegram delivery; keep DOCX as the editable source.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4 text-sm">
        {generatedDocuments.length > 0 ? (
          <div className="grid gap-3">
            {generatedDocuments.map((document) => (
              <div
                key={document.id}
                className={`grid gap-2 border-b border-border pb-3 last:border-0 last:pb-0 ${
                  selectedDocumentId === document.documentId ? "rounded-lg bg-primary/5 p-3" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{document.documentId}</p>
                    <p className="text-muted-foreground">
                      {document.documentType.toUpperCase()} from {document.sourceRecordIds.join(", ") || "assistant request"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {document.pdfAttachmentId ? (
                      <a
                        href={`/documents/attachments/${document.pdfAttachmentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        View PDF
                      </a>
                    ) : null}
                    {document.docxAttachmentId ? (
                      <a
                        href={`/documents/attachments/${document.docxAttachmentId}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                      >
                        Download DOCX
                      </a>
                    ) : null}
                  </div>
                </div>
                {document.fieldSnapshot ? (
                  <dl className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
                    {createDocumentFieldRows(document.fieldSnapshot).map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[96px_1fr] items-baseline gap-2">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <details className="text-muted-foreground">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">Source material</summary>
                  <p className="mt-2 whitespace-pre-wrap">{document.rawInput}</p>
                </details>
                <p className="text-xs text-muted-foreground">
                  DOCX attachment: {document.docxAttachmentId ?? "pending"} · PDF attachment:{" "}
                  {document.pdfAttachmentId ?? "pending"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Document table will render here.</p>
        )}
      </div>
    </section>
  );
}

function createDocumentFieldRows(
  fieldSnapshot: NonNullable<Awaited<ReturnType<typeof listAssistantGeneratedDocuments>>[number]["fieldSnapshot"]>
): Array<[string, string]> {
  return [
    ["Client", fieldSnapshot.clientName],
    ["Request", fieldSnapshot.requestType],
    ["Address", fieldSnapshot.projectAddress],
    ["BGF", fieldSnapshot.bgfM2 === null || fieldSnapshot.bgfM2 === undefined ? "" : `${fieldSnapshot.bgfM2} m2`],
    ["Email", fieldSnapshot.email],
    ["Phone", fieldSnapshot.phone],
    ["Missing", fieldSnapshot.missingData?.join(", ")]
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
}
