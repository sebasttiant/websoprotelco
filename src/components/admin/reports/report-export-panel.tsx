"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";

import { adminCard, adminDarkBtn, adminSecondaryBtn } from "@/components/admin/ui";
import type { ReportExportSection, ReportRange } from "@/domains/reports";

const STAGES: ReadonlyArray<{
  section: ReportExportSection;
  title: string;
  hint: string;
}> = [
  { section: "summary", title: "1. Resumen KPI", hint: "Métricas comerciales y catálogo" },
  { section: "orders", title: "2. Pedidos", hint: "Listado de pedidos del período" },
  { section: "quotes", title: "3. Cotizaciones", hint: "Listado de cotizaciones" },
  { section: "catalog", title: "4. Catálogo", hint: "Stock, categorías y top productos" },
  { section: "leads", title: "5. Leads", hint: "Estados y orígenes" },
  { section: "all", title: "6. Todo junto", hint: "Paquete completo de todas las etapas" },
];

function exportHref(range: ReportRange, section: ReportExportSection, format: "csv" | "xlsx"): string {
  return `/admin/reports/export?range=${range}&section=${section}&format=${format}`;
}

type ReportExportPanelProps = {
  range: ReportRange;
};

export function ReportExportPanel({ range }: ReportExportPanelProps) {
  return (
    <section className={`${adminCard} min-w-0 space-y-5 print:hidden`}>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-brand-navy">Exportar reporte</h3>
        <p className="mt-1 text-xs font-medium text-brand-muted">
          PDF (impresión del tablero), Excel (.xlsx) o CSV por etapas. Máximo 5.000 filas por listado.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className={adminDarkBtn}>
          <Printer aria-hidden="true" className="h-4 w-4" />
          PDF / Imprimir
        </button>
        <a href={exportHref(range, "all", "xlsx")} className={adminSecondaryBtn}>
          <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
          Excel completo
        </a>
        <a href={exportHref(range, "all", "csv")} className={adminSecondaryBtn}>
          <FileText aria-hidden="true" className="h-4 w-4" />
          CSV completo
        </a>
      </div>

      <div className="space-y-3">
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-muted">
          Por etapas
        </p>
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((stage) => (
            <li
              key={stage.section}
              className="min-w-0 rounded-2xl border border-brand-line bg-brand-ice/40 p-3.5"
            >
              <p className="text-sm font-black text-brand-navy">{stage.title}</p>
              <p className="mt-0.5 text-xs font-medium text-brand-muted">{stage.hint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={exportHref(range, stage.section, "xlsx")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
                >
                  <FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5" />
                  Excel
                </a>
                <a
                  href={exportHref(range, stage.section, "csv")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  CSV
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Compact header actions: PDF + Excel + CSV for the full pack. */
export function ReportExportActions({ range }: ReportExportPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={adminSecondaryBtn}>
        <Printer aria-hidden="true" className="h-4 w-4" />
        PDF
      </button>
      <a href={exportHref(range, "all", "xlsx")} className={adminSecondaryBtn}>
        <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
        Excel
      </a>
      <a href={exportHref(range, "all", "csv")} className={adminDarkBtn}>
        <Download aria-hidden="true" className="h-4 w-4" />
        CSV
      </a>
    </div>
  );
}
