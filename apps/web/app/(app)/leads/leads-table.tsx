"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { canMarkLeadKpSent, createLeadActionPlan, leadTableColumns, type LeadActionPlanItem, type LeadTableRow } from "./lead-table-store";

type LeadsTableProps = {
  rows: LeadTableRow[];
  updateLeadAction: (formData: FormData) => Promise<void>;
  markLeadKpSentAction: (formData: FormData) => Promise<void>;
};

export function LeadsTable({ rows, updateLeadAction, markLeadKpSentAction }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(rows[0]?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingKpSent, setIsMarkingKpSent] = useState(false);
  const router = useRouter();
  const selectedLead = rows.find((row) => row.id === selectedLeadId) ?? null;

  const columns = useMemo<Array<ColumnDef<LeadTableRow>>>(
    () =>
      leadTableColumns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        size: column.defaultSize,
        minSize: 92,
        enableSorting: column.enableSorting,
        cell: ({ getValue }) => <TruncatedCell value={String(getValue() ?? "")} />
      })),
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility, columnSizing },
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Lead table</h2>
            <p className="text-sm text-muted-foreground">Sort, resize, hide columns, then click a row to edit.</p>
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
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
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
                    onClick={() => setSelectedLeadId(row.original.id)}
                    className={`cursor-pointer transition hover:bg-muted/60 ${
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

      <aside className="rounded-lg border border-border bg-white">
        {selectedLead ? (
          <LeadEditor
            lead={selectedLead}
            actionPlan={createLeadActionPlan(selectedLead)}
            isSaving={isSaving}
            isMarkingKpSent={isMarkingKpSent}
            onClose={() => setSelectedLeadId(null)}
            onSubmit={handleSubmit}
            onMarkKpSent={() => handleMarkKpSent(selectedLead.id)}
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">Select a lead to edit its fields and action plan.</div>
        )}
      </aside>
    </div>
  );
}

function TruncatedCell({ value }: { value: string }) {
  return <span className="block max-w-full truncate text-foreground" title={value}>{value || "—"}</span>;
}

function LeadEditor({
  lead,
  actionPlan,
  isSaving,
  isMarkingKpSent,
  onClose,
  onSubmit,
  onMarkKpSent
}: {
  lead: LeadTableRow;
  actionPlan: LeadActionPlanItem[];
  isSaving: boolean;
  isMarkingKpSent: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMarkKpSent: () => void;
}) {
  return (
    <form key={lead.id} onSubmit={onSubmit} className="grid max-h-[calc(100vh-8rem)] gap-4 overflow-auto p-4">
      <input type="hidden" name="id" value={lead.id} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected lead</p>
          <h2 className="mt-1 text-lg font-semibold">{lead.leadId}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">
          Close
        </button>
      </div>

      <div className="grid gap-3">
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

      <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <h3 className="text-sm font-semibold">Action plan</h3>
        {actionPlan.map((item) => (
          <div key={`${item.title}-${item.dueDate}`} className="rounded-lg bg-white p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{item.title}</p>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{item.status}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{item.dueDate}</p>
            <p className="mt-1 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {canMarkLeadKpSent(lead) ? (
          <button
            type="button"
            disabled={isMarkingKpSent}
            onClick={onMarkKpSent}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {isMarkingKpSent ? "Marking..." : "Mark KP sent"}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
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
