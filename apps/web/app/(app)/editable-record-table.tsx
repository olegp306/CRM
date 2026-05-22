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
};

export function EditableRecordTable({ title, kind, fields, rows, updateAction }: EditableRecordTableProps) {
  const tableFields = fields.filter((field) => field.table);
  const editorFields = fields.filter((field) => field.editable);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columnVisibility, columnSizing, setColumnVisibility, setColumnSizing } = usePersistentTablePreferences(`editable-${kind}`);
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
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
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
                  <span>{tableFields.find((field) => field.key === column.id)?.label ?? column.id}</span>
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
            className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-auto rounded-lg border border-border bg-white p-5 shadow-xl"
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
