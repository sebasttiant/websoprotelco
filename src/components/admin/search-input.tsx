import { adminInput } from "@/components/admin/ui";

interface SearchInputProps {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}

export function SearchInput({ name = "q", defaultValue = "", placeholder = "Buscar" }: SearchInputProps) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      className={adminInput}
    />
  );
}
