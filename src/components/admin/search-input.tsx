interface SearchInputProps {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}

export function SearchInput({ name = "q", defaultValue = "", placeholder = "Search" }: SearchInputProps) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-blue-100"
    />
  );
}
