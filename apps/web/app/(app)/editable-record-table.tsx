"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  getEditableEmptyStateMessage,
  getEditableMobileCardFields,
  type EditableRecordKind,
  type EditableRecordRow,
  type EditableTableField
} from "./editable-record-table-store";
import { usePersistentTablePreferences } from "./table-preferences";

type EditableRecordTableProps = {
  title: string;
  kind: EditableRecordKind;
  fields: EditableTableField[];
  rows: EditableRecordRow[];
  updateAction: (formData: FormData) => Promise<void>;
  exportHref?: string;
};

type MobileTableViewMode = "cards" | "table";

export function EditableRecordTable({ title, kind, fields, rows, updateAction, exportHref }: EditableRecordTableProps) {
  const tableFields = fields.filter((field) => field.table);
  const editorFields = fields.filter((field) => field.editable);
  const mobileCardFields = useMemo(() => getEditableMobileCardFields(kind, fields), [fields, kind]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columnVisibility, columnSizing, setColumnVisibility, setColumnSizing } = usePersistentTablePreferences(`editable-${kind}`);
  const [mobileViewMode, setMobileViewMode] = useState<MobileTableViewMode>("cards");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;

  const columns = useMemo<Array<ColumnDef<EditableRecordRow>>>(
    () =>
      tableFields.map((field) => ({
        accessorKey: field.key,
        header: field.label,
        size: field.width ?? 160,
        minSize: 104,
        enableSorting: true,
        cell: ({ getValue }) => <TruncatedCell value={String(getValue() ?? "")} />
      })),
    [tableFields]
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
      await updateAction(new FormData(event.currentTarget));
      router.refresh();
      setSelectedId(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section className="grid gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">Cards for quick review, table for all columns.</p>
          </div>
          <MobileViewModeToggle value={mobileViewMode} onChange={setMobileViewMode} />
        </div>

        {mobileViewMode === "cards" ? (
          rows.length > 0 ? (
            <div className="grid gap-2">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="grid gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left shadow-sm transition hover:border-foreground/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate text-sm font-semibold leading-tight">{getMobileCardTitle(row, mobileCardFields, tableFields)}</h3>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold leading-5 text-muted-foreground">
                      {getMobileCardMeta(row, mobileCardFields) || "row"}
                    </span>
                  </div>
                  <CompactMobileFields fields={mobileCardFields} row={row} />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">{getEditableEmptyStateMessage(kind)}</div>
          )
        ) : null}
      </section>

      <section className={`${mobileViewMode === "cards" ? "hidden md:block" : "block"} min-w-0 overflow-hidden rounded-lg border border-border bg-white`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">Sort, resize, hide columns, then click a row to edit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exportHref ? (
              <a href={exportHref} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                Export to Excel (CSV)
              </a>
            ) : null}
            <div className="md:hidden">
              <MobileViewModeToggle value={mobileViewMode} onChange={setMobileViewMode} />
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
                    <span>{tableFields.find((field) => field.key === column.id)?.label ?? column.id}</span>
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
                    onClick={() => setSelectedId(row.original.id)}
                    className="cursor-pointer bg-white transition hover:bg-muted/60"
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
                    {getEditableEmptyStateMessage(kind)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <form
            key={selectedRow.id}
            onSubmit={handleSubmit}
            className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-auto rounded-lg border border-border bg-white p-5 pb-32 scroll-pb-32 shadow-xl"
          >
            <input type="hidden" name="id" value={selectedRow.id} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit row</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {editorFields.map((field) => (
                <EditorField key={field.key} field={field} value={selectedRow[field.key] ?? ""} />
              ))}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function TruncatedCell({ value }: { value: string }) {
  return (
    <span className="block max-w-full truncate text-foreground" title={value}>
      {value || "-"}
    </span>
  );
}

function MobileViewModeToggle({
  value,
  onChange
}: {
  value: MobileTableViewMode;
  onChange: (value: MobileTableViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-1">
      {(["cards", "table"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`h-8 rounded-md px-3 text-xs font-semibold capitalize transition ${
            value === mode ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

function CompactMobileFields({ fields, row }: { fields: EditableTableField[]; row: EditableRecordRow }) {
  return (
    <div className="grid gap-1">
      {fields.map((field) => (
        <div key={field.key} className="grid grid-cols-[74px_minmax(0,1fr)] items-baseline gap-2 leading-tight">
          <span className="text-[11px] font-normal text-muted-foreground">{field.label}</span>
          <span className="truncate text-[11px] font-semibold text-foreground">{row[field.key] || "-"}</span>
        </div>
      ))}
    </div>
  );
}

function getMobileCardTitle(row: EditableRecordRow, fields: EditableTableField[], tableFields: EditableTableField[]): string {
  const titleField = fields.find((field) => !/created|date|status|priority/i.test(field.key)) ?? tableFields[0];
  return titleField ? row[titleField.key] || titleField.label : "Record";
}

function getMobileCardMeta(row: EditableRecordRow, fields: EditableTableField[]): string {
  const metaField = fields.find((field) => /status|priority/i.test(field.key)) ?? fields.find((field) => /created|date/i.test(field.key));
  return metaField ? row[metaField.key] : "";
}

function EditorField({ field, value }: { field: EditableTableField; value: string }) {
  const commonClassName = "rounded-md border border-border px-3 py-2 text-sm";

  if (field.type === "textarea") {
    return (
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium text-foreground">{field.label}</span>
        <textarea name={field.key} defaultValue={value} required={field.required} className={`${commonClassName} min-h-24`} />
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{field.label}</span>
      <input
        name={field.key}
        defaultValue={value}
        required={field.required}
        type={getInputType(field.type)}
        inputMode={field.type === "number" ? "decimal" : undefined}
        className={commonClassName}
      />
    </label>
  );
}

function getInputType(type: EditableTableField["type"]) {
  if (type === "date" || type === "email" || type === "url") return type;
  return "text";
}

function getSortLabel(sortState: false | "asc" | "desc") {
  if (sortState === "asc") return "asc";
  if (sortState === "desc") return "desc";
  return "-";
}
