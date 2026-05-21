import {
  advanceActionConfirmation,
  captureAssistantContext,
  createActionPreview,
  createAssistantMessageDraft,
  createAssistantThreadDraft,
  createFeedbackItemFromMessage,
  getPermissionBlockedResponse
} from "@app/assistant";

const actionPreview = createActionPreview({
  actionType: "create_lead",
  summary: "Create lead for Anna Beispiel",
  changes: [
    { field: "client.name", from: null, to: "Anna Beispiel" },
    { field: "lead.bgfM2", from: null, to: 150 }
  ],
  warnings: ["Missing desired move-in date"]
});

const blocked = getPermissionBlockedResponse({
  role: "viewer",
  actionType: "create_lead",
  moduleContext: "leads"
});

const feedback = createFeedbackItemFromMessage({
  workspaceId: "workspace-demo",
  sourceThreadId: "thread-demo",
  sourceMessageId: "message-demo",
  intent: "feature_request",
  moduleContext: "assistant",
  role: "manager"
});

const context = captureAssistantContext({
  workspaceId: "workspace-demo",
  userId: "user-demo",
  role: "admin",
  route: "/leads",
  module: "leads",
  entity: { type: "lead", id: "lead-demo" },
  selectedRecordIds: ["lead-demo"]
});

const threadDraft = createAssistantThreadDraft({
  context,
  title: "Lead intake follow-up"
});

const messageDraft = createAssistantMessageDraft({
  threadId: "thread-demo",
  userId: context.userId,
  role: "user",
  content: "Please add a better mobile view",
  context
});

const confirmationStatus = advanceActionConfirmation("draft", "preview");

export default function AssistantPreviewPage() {
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Assistant action preview</h1>
        <p className="text-sm text-muted-foreground">Context capture, preview, permission blocking, and feedback signal rules.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <PreviewCard title="Action preview" lines={[actionPreview.summary, `${actionPreview.changes.length} proposed changes`, `${actionPreview.warnings.length} warning`]} />
        <PreviewCard title="Blocked action" lines={[blocked.message, `Role: ${blocked.role}`, `Module: ${blocked.moduleContext}`]} />
        <PreviewCard title="Feedback draft" lines={feedback ? [`Type: ${feedback.type}`, `Status: ${feedback.status}`, `Priority: ${feedback.priority}`] : ["No feedback"]} />
        <PreviewCard title="Captured context" lines={[`Route: ${context.route}`, `Module: ${context.module}`, `Entity: ${context.entity?.type}:${context.entity?.id}`]} />
        <PreviewCard title="Message draft" lines={[`Thread: ${threadDraft.title}`, `Author: ${messageDraft.role}`, `Intent: ${messageDraft.intent}`]} />
        <PreviewCard title="Confirmation state" lines={[`Status: ${confirmationStatus}`, "Next: confirm or cancel"]} />
      </div>
    </section>
  );
}

function PreviewCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
