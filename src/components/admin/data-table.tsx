import Link from "next/link";
import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  emptyMessage: string;
  page?: number;
  totalPages?: number;
  pageHref?: (page: number) => string;
}

export function DataTable<Row>({ rows, columns, emptyMessage, page = 1, totalPages = 1, pageHref }: DataTableProps<Row>) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm shadow-blue-950/5">
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[40rem] border-collapse divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80 text-left text-[0.65rem] font-black uppercase tracking-widest text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-middle">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      <div className="min-w-0 max-w-[18rem] sm:max-w-none">{column.render(row)}</div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center font-medium text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageHref && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">
          <Link
            aria-label="Página anterior"
            aria-disabled={page <= 1}
            href={pageHref(Math.max(1, page - 1))}
            className="rounded-full border border-slate-200 px-3.5 py-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Anterior
          </Link>
          <span>
            Página {page} de {totalPages}
          </span>
          <Link
            aria-label="Página siguiente"
            aria-disabled={page >= totalPages}
            href={pageHref(Math.min(totalPages, page + 1))}
            className="rounded-full border border-slate-200 px-3.5 py-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Siguiente
          </Link>
        </div>
      ) : null}
    </div>
  );
}
