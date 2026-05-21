import type { CrmListKind, CrmListRow } from "./crm-list-store";
import { getCrmEmptyStateMessage } from "./crm-list-store";

export function CrmList({ kind, rows }: { kind: CrmListKind; rows: CrmListRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-sm">
      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={row.id} className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{row.primary}</p>
                {row.meta ? <span className="text-xs font-medium text-muted-foreground">{row.meta}</span> : null}
              </div>
              <p className="text-muted-foreground">{row.secondary}</p>
              {row.detail ? <p className="text-muted-foreground">{row.detail}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">{getCrmEmptyStateMessage(kind)}</p>
      )}
    </div>
  );
}
