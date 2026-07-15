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
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-blue-950/5">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-5 py-4">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4 text-slate-700">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center font-medium text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageHref && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm font-bold text-slate-600">
          <Link aria-label="Página anterior" aria-disabled={page <= 1} href={pageHref(Math.max(1, page - 1))} className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40">
            Anterior
          </Link>
          <span>
            Página {page} de {totalPages}
          </span>
          <Link aria-label="Página siguiente" aria-disabled={page >= totalPages} href={pageHref(Math.min(totalPages, page + 1))} className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40">
            Siguiente
          </Link>
        </div>
      ) : null}
    </div>
  );
}
