interface StatusChangeFormProps {
  action: (formData: FormData) => Promise<void>;
  id: string;
  currentStatus: string;
  options: readonly string[];
  labelFor: (status: string) => string;
}

/** Compact status updater that wraps instead of blowing table row width. */
export function StatusChangeForm({ action, id, currentStatus, options, labelFor }: StatusChangeFormProps) {
  return (
    <form action={action} className="flex min-w-0 max-w-[14rem] flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={currentStatus}
        className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-brand-blue"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-white transition hover:bg-slate-800"
      >
        Guardar
      </button>
    </form>
  );
}
