"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  canMarkLeadKpSent,
  canUndoLeadKpSent,
  clampLeadColumnSizing,
  createLeadActionPlan,
  createLeadHistory,
  createLeadKpMailtoHref,
  createKpDownloadBaseName,
  createLeadLoopTimelineViewModel,
  createLeadSummaryInfo,
  getLeadSourceMaterials,
  isInlineEditableLeadField,
  leadTableColumns,
  leadTableViewModeStorageKey,
  leadMobileCardFields,
  leadMobileViewModes,
  leadTableViewModes,
  normalizeLeadTableViewMode,
  resolveDeepLinkedLeadRowId,
  resolveInitialSelectedLeadId,
  type LeadMobileViewMode,
  type LeadActionPlanItem,
  type LeadHistoryItem,
  type LeadSummaryInfoItem,
  type LeadLoopStepMode,
  type LeadLoopTimelineStep,
  type LeadTableColumnKey,
  type LeadTableRow,
  type LeadTableViewMode
} from "./lead-table-store";
import { usePersistentTablePreferences } from "../table-preferences";

type LeadsTableProps = {
  rows: LeadTableRow[];
  updateLeadAction: (formData: FormData) => Promise<void>;
  markLeadKpSentAction: (formData: FormData) => Promise<void>;
  undoLeadKpSentAction: (formData: FormData) => Promise<void>;
};

const leadAccordionClassName = "min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30";
const leadAccordionSummaryClassName = "flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-semibold";

export function LeadsTable({ rows, updateLeadAction, markLeadKpSentAction, undoLeadKpSentAction }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columnVisibility, columnSizing, setColumnVisibility, setColumnSizing } = usePersistentTablePreferences("leads");
  const [viewMode, setViewMode] = useState<LeadTableViewMode>("split");
  const [isViewModeHydrated, setIsViewModeHydrated] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<LeadMobileViewMode>("cards");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingKpSent, setIsMarkingKpSent] = useState(false);
  const [isUndoingKpSent, setIsUndoingKpSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedLeadId = searchParams.get("leadId");
  const selectedLead = rows.find((row) => row.id === selectedLeadId) ?? null;
  const clampedColumnSizing = useMemo(
    () => clampLeadColumnSizing(columnSizing) as ColumnSizingState,
    [columnSizing]
  );

  useEffect(() => {
    const deepLinkedLeadRowId = resolveDeepLinkedLeadRowId(rows, deepLinkedLeadId);

    if (deepLinkedLeadRowId) {
      setSelectedLeadId(deepLinkedLeadRowId);
      setIsViewModeHydrated(true);
      return;
    }

    try {
      const storedViewMode = normalizeLeadTableViewMode(window.localStorage.getItem(leadTableViewModeStorageKey));
      setViewMode(storedViewMode);
      setSelectedLeadId(resolveInitialSelectedLeadId(storedViewMode, rows.map((row) => row.id)));
    } catch {
      setViewMode("split");
      setSelectedLeadId(resolveInitialSelectedLeadId("split", rows.map((row) => row.id)));
    }
    setIsViewModeHydrated(true);
  }, [deepLinkedLeadId, rows]);

  useEffect(() => {
    if (!isViewModeHydrated) {
      return;
    }

    window.localStorage.setItem(leadTableViewModeStorageKey, viewMode);
  }, [isViewModeHydrated, viewMode]);

  useEffect(() => {
    if (JSON.stringify(columnSizing) !== JSON.stringify(clampedColumnSizing)) {
      setColumnSizing(clampedColumnSizing);
    }
  }, [clampedColumnSizing, columnSizing, setColumnSizing]);

  const columns = useMemo<Array<ColumnDef<LeadTableRow>>>(
    () =>
      leadTableColumns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        size: column.defaultSize,
        maxSize: column.maxSize,
        minSize: 92,
        enableSorting: column.enableSorting,
        cell: ({ getValue, row }) =>
          viewMode === "inline" && isInlineEditableLeadField(column.key) ? (
            <InlineLeadCell
              fieldName={column.key}
              row={row.original}
              isSaving={isSaving}
              onSubmit={handleInlineSubmit}
            />
          ) : column.key === "rawInput" ? (
            <SourceMaterialsCell value={String(getValue() ?? "")} />
          ) : (
            <TruncatedCell value={String(getValue() ?? "")} />
          )
      })),
    [isSaving, viewMode]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility, columnSizing: clampedColumnSizing },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateLeadAction(new FormData(event.currentTarget));
      router.refresh();
      if (viewMode === "full") {
        setSelectedLeadId(null);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInlineSubmit(formData: FormData) {
    setIsSaving(true);
    try {
      await updateLeadAction(formData);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkKpSent(leadId: string) {
    const formData = new FormData();
    formData.set("id", leadId);
    setIsMarkingKpSent(true);
    try {
      await markLeadKpSentAction(formData);
      router.refresh();
    } finally {
      setIsMarkingKpSent(false);
    }
  }

  async function handleUndoKpSent(leadId: string) {
    const confirmed = window.confirm("Return this lead to the previous manual step and mark the KP as not sent?");
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("id", leadId);
    setIsUndoingKpSent(true);
    try {
      await undoLeadKpSentAction(formData);
      router.refresh();
    } finally {
      setIsUndoingKpSent(false);
    }
  }

  function handleCloseSelectedLead() {
    setSelectedLeadId(null);
    if (deepLinkedLeadId) {
      router.replace("/leads");
    }
  }

  function handleViewModeChange(mode: LeadTableViewMode) {
    setViewMode(mode);
    setSelectedLeadId(resolveInitialSelectedLeadId(mode, rows.map((row) => row.id)));
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
          <div>
            <h2 className="text-base font-semibold">Leads</h2>
            <p className="text-xs text-muted-foreground">Card view for mobile, table when you need all columns.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            {leadMobileViewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                title={mode.description}
                onClick={() => setMobileViewMode(mode.id)}
                className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                  mobileViewMode === mode.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {mobileViewMode === "cards" ? (
          rows.length > 0 ? (
            <div className="grid gap-2">
              {rows.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="grid gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-left shadow-sm transition hover:border-foreground/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] leading-none text-muted-foreground">Lead</p>
                      <h3 className="mt-0.5 text-sm font-semibold leading-tight">{lead.leadId}</h3>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold leading-5 text-muted-foreground">
                      {lead.status || "new"}
                    </span>
                  </div>
                  <div className="grid gap-0.5">
                    {leadMobileCardFields.map((field) => (
                      <div key={field} className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-2 leading-[1.15]">
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {leadTableColumns.find((column) => column.key === field)?.label ?? field}
                        </span>
                        <span className="truncate text-[11px] font-semibold text-foreground">{lead[field] || "-"}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">No leads found yet.</div>
          )
        ) : null}
      </section>

      <section className={`${mobileViewMode === "cards" ? "hidden md:block" : "block"} min-w-0 overflow-hidden rounded-lg border border-border bg-white`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Lead table</h2>
            <p className="text-sm text-muted-foreground">
              {viewMode === "inline" ? "Sort, resize, hide columns, then edit safe fields directly." : "Sort, resize, hide columns, then click a row to edit."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/exports/leads" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
              Export to Excel (CSV)
            </a>
            <div className="inline-flex rounded-lg border border-border bg-muted p-1">
              {leadTableViewModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.description}
                  onClick={() => handleViewModeChange(mode.id)}
                  className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                    viewMode === mode.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <details className="relative">
              <summary className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                Columns
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid max-h-96 w-64 gap-2 overflow-auto rounded-lg border border-border bg-white p-3 shadow-xl">
                {table.getAllLeafColumns().map((column) => (
                  <label key={column.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    <span>{leadTableColumns.find((item) => item.key === column.id)?.label ?? column.id}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-sm" style={{ width: table.getTotalSize() }}>
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="relative border-b border-r border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        <span className="text-[10px]">{getSortLabel(header.column.getIsSorted())}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Resize column"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent hover:bg-primary/30"
                      />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={viewMode === "inline" ? undefined : () => setSelectedLeadId(row.original.id)}
                    className={`${viewMode === "inline" ? "" : "cursor-pointer"} transition hover:bg-muted/60 ${
                      row.original.id === selectedLeadId ? "bg-primary/5" : "bg-white"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-b border-r border-border px-3 py-2 align-top last:border-r-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-8 text-sm text-muted-foreground">
                    No leads found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLead ? (
        <div className="fixed inset-0 z-50 bg-white">
          <LeadEditor
            lead={selectedLead}
            actionPlan={createLeadActionPlan(selectedLead)}
            isSaving={isSaving}
            isMarkingKpSent={isMarkingKpSent}
            isUndoingKpSent={isUndoingKpSent}
            onClose={handleCloseSelectedLead}
            onSubmit={handleSubmit}
            onMarkKpSent={() => handleMarkKpSent(selectedLead.id)}
            onUndoKpSent={() => handleUndoKpSent(selectedLead.id)}
            variant="fullscreen"
          />
        </div>
      ) : null}

    </div>
  );
}

function getCompactLoopStepClassName(step: LeadLoopTimelineStep): string {
  const doneByMode: Record<LeadLoopStepMode, string> = {
    manual: "border-amber-300 bg-amber-100 text-amber-900",
    automatic: "border-emerald-300 bg-emerald-100 text-emerald-900",
    branch: "border-sky-300 bg-sky-100 text-sky-900"
  };
  const upcomingByMode: Record<LeadLoopStepMode, string> = {
    manual: "border-amber-100 bg-amber-50/40 text-amber-900/35",
    automatic: "border-emerald-100 bg-emerald-50/40 text-emerald-900/35",
    branch: "border-sky-100 bg-sky-50/40 text-sky-900/35"
  };

  if (step.progressState === "current") {
    return `${doneByMode[step.mode]} ring-2 ring-foreground ring-offset-1`;
  }

  return step.progressState === "done" ? doneByMode[step.mode] : upcomingByMode[step.mode];
}

function getLoopModeBadgeClassName(mode: LeadLoopStepMode): string {
  const classes: Record<LeadLoopStepMode, string> = {
    manual: "bg-amber-100 text-amber-800",
    automatic: "bg-emerald-100 text-emerald-800",
    branch: "bg-sky-100 text-sky-800"
  };
  return classes[mode];
}

function TruncatedCell({ value }: { value: string }) {
  return <span className="block max-w-full truncate text-foreground" title={value}>{value || "—"}</span>;
}

function SourceMaterialsCell({ value }: { value: string }) {
  const materials = getLeadSourceMaterials(value);

  if (!materials.sourceText) {
    return <TruncatedCell value="" />;
  }

  return (
    <span className="grid max-w-full gap-0.5" title={materials.sourceText}>
      <span className="truncate text-foreground">{materials.sourceText}</span>
      {materials.references.length > 0 ? (
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          Sources: {materials.references.map((reference) => reference.label).join(", ")}
        </span>
      ) : null}
    </span>
  );
}

const leadEditorFieldNames: LeadTableColumnKey[] = [
  "clientRecordId",
  "temperature",
  "requestType",
  "urgency",
  "budgetEur",
  "desiredStart",
  "desiredMoveIn",
  "bgfM2",
  "wohnflaecheM2",
  "projectAddress",
  "isStandard",
  "status",
  "rawInput",
  "missingData",
  "kpGeneratedDocumentId",
  "kpSentDate",
  "followup1Date",
  "followupStatus",
  "outcome",
  "outcomeReason",
  "projectRecordId"
];

function InlineLeadCell({
  fieldName,
  row,
  isSaving,
  onSubmit
}: {
  fieldName: LeadTableColumnKey;
  row: LeadTableRow;
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [value, setValue] = useState(row[fieldName] ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  function submitIfChanged(form: HTMLFormElement | null) {
    if (form && value !== (row[fieldName] ?? "")) {
      form.requestSubmit();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitIfChanged(event.currentTarget.form);
    }
  }

  return (
    <form onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()} className="min-w-0">
      <input type="hidden" name="id" value={row.id} />
      {leadEditorFieldNames.map((name) =>
        name === fieldName ? null : <input key={name} type="hidden" name={name} value={row[name] ?? ""} />
      )}
      <input
        name={fieldName}
        value={value}
        disabled={isSaving}
        required={fieldName === "status"}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => submitIfChanged(event.currentTarget.form)}
        onKeyDown={handleKeyDown}
        className="h-8 w-full min-w-28 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-border hover:bg-white focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        title="Edit inline, then press Enter or leave the cell to save"
      />
    </form>
  );
}

function LeadEditor({
  lead,
  actionPlan,
  isSaving,
  isMarkingKpSent,
  isUndoingKpSent,
  onClose,
  onSubmit,
  onMarkKpSent,
  onUndoKpSent,
  variant
}: {
  lead: LeadTableRow;
  actionPlan: LeadActionPlanItem[];
  isSaving: boolean;
  isMarkingKpSent: boolean;
  isUndoingKpSent: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMarkKpSent: () => void;
  onUndoKpSent: () => void;
  variant: "fullscreen";
}) {
  const sourceMaterials = getLeadSourceMaterials(lead.rawInput);
  const leadSummaryInfo = createLeadSummaryInfo(lead.rawInput);
  const history = createLeadHistory(lead);
  const timeline = createLeadLoopTimelineViewModel(lead);
  const currentStep = timeline.steps.find((step) => step.isCurrent) ?? timeline.steps[0];
  const nextAction = actionPlan[0];

  return (
    <form
      key={lead.id}
      onSubmit={onSubmit}
      data-variant={variant}
      className="grid h-screen max-h-screen gap-4 overflow-auto p-4 pb-32 scroll-pb-32"
    >
      <input type="hidden" name="id" value={lead.id} />
      <div className="sticky top-0 z-30 -mx-4 -mt-4 flex justify-end border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label="Full screen lead close"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Close
        </button>
      </div>
      <section className="grid gap-1 rounded-lg border border-border bg-muted/20 p-3">
        <div className="-mx-3 -mt-3 grid gap-2 border-b border-border bg-white/95 px-3 py-3 backdrop-blur">
          <div className="grid min-w-0 gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lead card</p>
            <h2 className="mt-1 text-base font-semibold leading-tight text-foreground sm:text-lg">{lead.leadId}</h2>
            <p className="text-xs text-muted-foreground">
              Created <span className="font-semibold text-foreground">{lead.createdDate || "No data"}</span>
            </p>
          </div>
          <div className="grid">
            <span
              title={currentStep.description}
              className={`w-full rounded-md px-2 py-1 text-left text-[11px] font-bold ${getLoopModeBadgeClassName(currentStep.mode)}`}
            >
              Stage {currentStep.id} - {currentStep.title}
            </span>
          </div>
        </div>

        <CompactLeadLoopProgress timeline={timeline} />
        <LeadNextActionRow lead={lead} nextAction={nextAction} />
        <LeadKpSummary lead={lead} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <LeadDownloadButtons lead={lead} />
          </div>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {canMarkLeadKpSent(lead) ? (
              <button
                type="button"
                disabled={isMarkingKpSent}
                onClick={onMarkKpSent}
                className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {isMarkingKpSent ? "Marking..." : "Mark KP sent"}
              </button>
            ) : null}
            {canUndoLeadKpSent(lead) ? (
              <button
                type="button"
                disabled={isUndoingKpSent}
                onClick={onUndoKpSent}
                className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {isUndoingKpSent ? "Undoing..." : "Undo KP sent"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <LeadSummaryInfoPanel items={leadSummaryInfo} />
      <LeadHistoryPanel history={history} />
      <ActionPlanPanel actionPlan={actionPlan} />
      <SourceMaterialsPanel sourceText={sourceMaterials.sourceText} references={sourceMaterials.references} />

      <div id="lead-edit-fields" className="grid gap-3">
        <TextField label="Client ID" name="clientRecordId" defaultValue={lead.clientRecordId} />
        <TextField label="Temperature" name="temperature" defaultValue={lead.temperature} />
        <TextField label="Request type" name="requestType" defaultValue={lead.requestType} />
        <TextField label="Urgency" name="urgency" defaultValue={lead.urgency} />
        <TextField label="Budget EUR" name="budgetEur" defaultValue={lead.budgetEur} inputMode="decimal" />
        <DateField label="Desired start" name="desiredStart" defaultValue={lead.desiredStart} />
        <DateField label="Desired move-in" name="desiredMoveIn" defaultValue={lead.desiredMoveIn} />
        <TextField label="BGF m2" name="bgfM2" defaultValue={lead.bgfM2} inputMode="decimal" />
        <TextField label="Wohnfläche m2" name="wohnflaecheM2" defaultValue={lead.wohnflaecheM2} inputMode="decimal" />
        <TextField label="Project address" name="projectAddress" defaultValue={lead.projectAddress} />
        <SelectField label="Standard" name="isStandard" defaultValue={lead.isStandard} options={["", "yes", "no"]} />
        <TextField label="Status" name="status" defaultValue={lead.status} required />
        <TextareaField label="Raw input" name="rawInput" defaultValue={lead.rawInput} />
        <TextareaField label="Missing data" name="missingData" defaultValue={lead.missingData} />
        <TextField label="KP document" name="kpGeneratedDocumentId" defaultValue={lead.kpGeneratedDocumentId} />
        <DateField label="KP sent date" name="kpSentDate" defaultValue={lead.kpSentDate} />
        <DateField label="Follow-up date" name="followup1Date" defaultValue={lead.followup1Date} />
        <TextField label="Follow-up status" name="followupStatus" defaultValue={lead.followupStatus} />
        <TextField label="Outcome" name="outcome" defaultValue={lead.outcome} />
        <TextareaField label="Outcome reason" name="outcomeReason" defaultValue={lead.outcomeReason} />
        <TextField label="Project ID" name="projectRecordId" defaultValue={lead.projectRecordId} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function LeadDownloadButtons({ lead }: { lead: LeadTableRow }) {
  const baseName = createKpDownloadBaseName(lead);

  return (
    <>
      {lead.kpPdfAttachmentId ? (
        <a
          href={`/documents/attachments/${encodeURIComponent(lead.kpPdfAttachmentId)}?filename=${encodeURIComponent(`${baseName}.pdf`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          KP PDF
        </a>
      ) : null}
      {lead.kpDocxAttachmentId ? (
        <a
          href={`/documents/attachments/${encodeURIComponent(lead.kpDocxAttachmentId)}?download=1&filename=${encodeURIComponent(`${baseName}.docx`)}`}
          download={`${baseName}.docx`}
          className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground"
        >
          KP DOC
        </a>
      ) : null}
    </>
  );
}

function LeadNextActionRow({ lead, nextAction }: { lead: LeadTableRow; nextAction: LeadActionPlanItem | undefined }) {
  const mailtoHref = createLeadKpMailtoHref(lead, typeof window === "undefined" ? "" : window.location.origin);
  const isKpAction = nextAction ? ["Complete missing data", "Generate KP", "Send KP"].includes(nextAction.title) : false;
  const canSendKp = isKpAction && Boolean(mailtoHref) && lead.missingData.trim().length === 0;
  const hasManualAction = Boolean(nextAction);
  const actionLabel = isKpAction ? "Send KP" : (nextAction?.title ?? "Action");
  const disabledReason =
    isKpAction && lead.missingData.trim().length > 0
      ? `Add missing data first: ${lead.missingData}`
      : isKpAction && !lead.kpGeneratedDocumentId.trim()
        ? "Generate the KP document first."
        : isKpAction && !mailtoHref
          ? "Create PDF or DOC before sending KP."
          : "";

  function handleGenericAction() {
    document.getElementById("lead-edit-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-2 rounded-md bg-white p-2 text-xs sm:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)] sm:items-stretch">
      <div className="min-w-0 self-center px-1 py-1">
        <span className="text-muted-foreground">Waiting for </span>
        <span className="font-semibold text-foreground">{nextAction ? nextAction.title : "No immediate action"}</span>
        <span className="text-muted-foreground">
          {nextAction ? ` - ${nextAction.description}` : " - Lead is not waiting on a specific manual step."}
        </span>
      </div>
      {canSendKp && mailtoHref ? (
        <a
          href={mailtoHref}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          {actionLabel}
        </a>
      ) : isKpAction ? (
        <button
          type="button"
          disabled
          title={disabledReason}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground opacity-70"
          aria-label={`${actionLabel} unavailable. ${disabledReason}`}
        >
          {actionLabel}
        </button>
      ) : hasManualAction ? (
        <button
          type="button"
          onClick={handleGenericAction}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          aria-label={`Open action for ${nextAction?.title}`}
        >
          {actionLabel}
        </button>
      ) : (
        <div className="hidden sm:block" aria-hidden="true" />
      )}
    </div>
  );
}

function LeadSummaryInfoPanel({ items }: { items: LeadSummaryInfoItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LeadCardAccordion title="Lead summary info" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      <div className="grid min-w-0 gap-2 px-3 pb-3">
        {items.length > 0 ? (
          items.map((item, index) => (
            <article key={`${item.title}-${item.kind}-${index}`} className="min-w-0 overflow-hidden rounded-lg bg-white p-3 text-sm">
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{item.kind}</p>
                </div>
                <p className="min-w-0 break-words text-sm text-muted-foreground">{item.description}</p>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit rounded-md border border-border px-2 py-1 text-xs font-semibold text-primary"
                  >
                    Download
                  </a>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-lg bg-white p-3 text-sm text-muted-foreground">No summarized source materials saved yet.</p>
        )}
      </div>
    </LeadCardAccordion>
  );
}

function LeadCardAccordion({
  title,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={leadAccordionClassName}>
      <button type="button" className={leadAccordionSummaryClassName} aria-expanded={isOpen} onClick={onToggle}>
        <span>{title}</span>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen ? children : null}
    </section>
  );
}

function LeadHistoryPanel({ history }: { history: LeadHistoryItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LeadCardAccordion title="History" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      <div className="grid gap-2 px-3 pb-3">
        {history.map((item, index) => (
          <article key={`${item.title}-${item.at}-${index}`} className="rounded-lg bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {item.at} · {item.actor}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{item.stageLabel}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </div>
    </LeadCardAccordion>
  );
}

function ActionPlanPanel({ actionPlan }: { actionPlan: LeadActionPlanItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LeadCardAccordion title="Action plan" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      <div className="grid gap-2 px-3 pb-3">
        {actionPlan.length > 0 ? (
          actionPlan.map((item) => (
            <div key={`${item.title}-${item.dueDate}`} className="rounded-lg bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{item.title}</p>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{item.status}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{item.dueDate}</p>
              <p className="mt-1 text-muted-foreground">{item.description}</p>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-white p-3 text-sm text-muted-foreground">No action is waiting right now.</p>
        )}
      </div>
    </LeadCardAccordion>
  );
}

function CompactLeadLoopProgress({ timeline }: { timeline: ReturnType<typeof createLeadLoopTimelineViewModel> }) {
  return (
    <ol className="grid grid-cols-9 gap-1">
      {timeline.steps.map((step) => (
        <li key={step.id}>
          <button
            type="button"
            title={`${step.id}. ${step.title}: ${step.description}`}
            className={`grid h-8 w-full place-items-center rounded-md border text-[11px] font-bold transition ${getCompactLoopStepClassName(step)}`}
          >
            {step.id}
          </button>
        </li>
      ))}
    </ol>
  );
}

function LeadKpSummary({ lead }: { lead: LeadTableRow }) {
  const fields = [
    { label: "Temperature", value: lead.temperature, badge: <TemperatureBadge value={lead.temperature} /> },
    { label: "Request", value: lead.requestType },
    { label: "Address", value: lead.projectAddress },
    { label: "BGF", value: lead.bgfM2 ? `${lead.bgfM2} m2` : "" },
    { label: "Budget", value: lead.budgetEur ? `${lead.budgetEur} EUR` : "" },
    { label: "Missing", value: lead.missingData || "No data" },
    { label: "KP", value: lead.kpGeneratedDocumentId || "No data" }
  ];

  return (
    <div className="grid gap-1.5 rounded-md bg-white p-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="grid grid-cols-[82px_minmax(0,1fr)] items-baseline gap-2 text-xs leading-tight">
          <span className="text-muted-foreground">{field.label}</span>
          {field.badge ?? <span className="truncate font-semibold text-foreground">{field.value || "No data"}</span>}
        </div>
      ))}
    </div>
  );
}

function TemperatureBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const classes =
    normalized === "hot"
      ? "bg-rose-100 text-rose-800"
      : normalized === "warm"
        ? "bg-amber-100 text-amber-800"
        : normalized === "cold"
          ? "bg-sky-100 text-sky-800"
          : "bg-muted text-muted-foreground";

  return <span className={`w-fit rounded-md px-2 py-0.5 text-[11px] font-bold ${classes}`}>{value || "No data"}</span>;
}

function SourceMaterialsPanel({
  sourceText,
  references
}: {
  sourceText: string;
  references: ReturnType<typeof getLeadSourceMaterials>["references"];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LeadCardAccordion title="Source materials" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      {sourceText ? (
        <div className="grid min-w-0 gap-2 px-3 pb-3">
          {references.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-2">
              {references.map((reference) =>
                reference.url ? (
                  <a
                    key={reference.label}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-full rounded-md bg-white px-2 py-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    <span className="break-all">{reference.label}</span>
                  </a>
                ) : (
                  <span key={reference.label} className="max-w-full rounded-md bg-white px-2 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="break-all">{reference.label}</span>
                  </span>
                )
              )}
            </div>
          ) : null}
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-white p-3 text-xs leading-relaxed text-foreground">
            {sourceText}
          </pre>
        </div>
      ) : (
        <p className="mx-3 mb-3 rounded-lg bg-white p-3 text-sm text-muted-foreground">No source text or document references saved yet.</p>
      )}
    </LeadCardAccordion>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  inputMode,
  required
}: {
  label: string;
  name: string;
  defaultValue: string;
  inputMode?: "decimal";
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input name={name} defaultValue={defaultValue} inputMode={inputMode} required={required} className="rounded-md border border-border px-3 py-2" />
    </label>
  );
}

function DateField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input name={name} type="date" defaultValue={defaultValue} className="rounded-md border border-border px-3 py-2" />
    </label>
  );
}

function TextareaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <textarea name={name} defaultValue={defaultValue} className="min-h-20 rounded-md border border-border px-3 py-2" />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-md border border-border px-3 py-2">
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || "Unknown"}
          </option>
        ))}
      </select>
    </label>
  );
}

function getSortLabel(sortState: false | "asc" | "desc") {
  if (sortState === "asc") return "↑";
  if (sortState === "desc") return "↓";
  return "↕";
}
