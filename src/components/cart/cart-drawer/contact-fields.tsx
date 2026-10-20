import type { ContactForm } from "./contact";

interface ContactFieldsProps {
  form: ContactForm;
  onChange: (key: keyof ContactForm, value: string) => void;
  /** Keeps input ids unique when the fields render outside the drawer (cart page). */
  idPrefix?: string;
}

const TEXT_FIELDS = [
  { key: "name", label: "Nombre", type: "text", placeholder: "Juan Pérez" },
  { key: "email", label: "Correo", type: "email", placeholder: "juan@ejemplo.com" },
  { key: "phone", label: "Teléfono", type: "tel", placeholder: "300 123 4567" },
] as const;

export function ContactFields({ form, onChange, idPrefix = "drawer" }: ContactFieldsProps) {
  return (
    <div className="space-y-4">
      {TEXT_FIELDS.map(({ key, label, type, placeholder }) => (
        <div key={key}>
          <label htmlFor={`${idPrefix}-${key}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
            {label}
          </label>
          <input
            id={`${idPrefix}-${key}`}
            type={type}
            required
            autoComplete={key === "name" ? "name" : key === "email" ? "email" : "tel"}
            placeholder={placeholder}
            value={form[key]}
            onChange={(event) => onChange(key, event.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-brand-line px-4 py-3 font-bold text-brand-navy"
          />
        </div>
      ))}
      <div>
        <label htmlFor={`${idPrefix}-notes`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
          Notas (opcional)
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={3}
          placeholder="Dirección, observaciones…"
          value={form.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-brand-line px-4 py-3 font-bold text-brand-navy"
        />
      </div>
    </div>
  );
}
