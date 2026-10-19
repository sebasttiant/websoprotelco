/** Shared admin surface tokens — keep radii/gaps consistent so the panel cannot drift. */

export const adminEyebrow =
  "text-[0.65rem] font-black uppercase tracking-[0.14em] text-brand-blue";

export const adminTitle =
  "text-2xl font-black tracking-tight text-brand-navy sm:text-3xl";

export const adminLead = "mt-1.5 max-w-2xl text-sm font-medium leading-6 text-brand-muted";

export const adminPage = "min-w-0 space-y-5";

export const adminCard =
  "min-w-0 rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 sm:p-5";

export const adminPanel =
  "min-w-0 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm shadow-blue-950/5";

/** Filter / toolbar: stacks on mobile; products use 4 slots from lg. */
export const adminFilterBar =
  "grid min-w-0 grid-cols-1 items-stretch gap-3 rounded-2xl border border-brand-line bg-white p-3.5 shadow-sm shadow-blue-950/5 sm:grid-cols-2 sm:items-center sm:p-4 lg:grid-cols-[minmax(0,1fr)_10rem_auto_auto]";

/** Orders / quotes: search + status + submit. */
export const adminFilterBarCompact =
  "grid min-w-0 grid-cols-1 items-stretch gap-3 rounded-2xl border border-brand-line bg-white p-3.5 shadow-sm shadow-blue-950/5 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center sm:p-4";

export const adminInput =
  "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100";

export const adminSelect =
  "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100 sm:w-auto";

export const adminChip =
  "inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-brand-ice px-3.5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy";

export const adminPrimaryBtn =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary";

export const adminSecondaryBtn =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue";

export const adminDarkBtn =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800";

export const adminHeaderRow =
  "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between";

export const adminActions = "flex flex-wrap items-center gap-2";
