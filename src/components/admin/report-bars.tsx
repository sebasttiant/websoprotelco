interface ReportBarItem {
  label: string;
  count: number;
}

interface ReportBarsProps {
  title: string;
  items: ReportBarItem[];
  emptyMessage: string;
}

export function ReportBars({ title, items, emptyMessage }: ReportBarsProps) {
  const max = Math.max(...items.map((item) => item.count), 0);

  return (
    <section className="min-w-0 rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 sm:p-5">
      <h2 className="text-sm font-black text-brand-navy">{title}</h2>
      {items.length === 0 || max === 0 ? (
        <p className="mt-4 text-sm font-medium text-brand-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const width = max > 0 ? Math.max(4, Math.round((item.count / max) * 100)) : 0;
            return (
              <li key={item.label} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-bold text-slate-700">{item.label}</span>
                  <span className="shrink-0 font-black text-brand-navy">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-blue transition-[width]"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
