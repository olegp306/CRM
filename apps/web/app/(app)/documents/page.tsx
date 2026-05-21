import { getWorkspaceSession } from "../../workspace-session";
import { listAssistantGeneratedDocuments } from "../assistant/document-execution-store";

export default async function DocumentsPage() {
  const session = await getWorkspaceSession();
  const generatedDocuments = await listAssistantGeneratedDocuments(session.workspaceId);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">Generated KP documents, templates, and document history.</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4 text-sm">
        {generatedDocuments.length > 0 ? (
          <div className="grid gap-3">
            {generatedDocuments.map((document) => (
              <div key={document.id} className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="font-semibold text-foreground">{document.documentId}</p>
                <p className="text-muted-foreground">
                  {document.documentType.toUpperCase()} from {document.sourceRecordIds.join(", ") || "assistant request"}
                </p>
                <p className="text-muted-foreground">{document.rawInput}</p>
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
