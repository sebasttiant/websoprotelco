"use client";

import { useEffect, useRef, useState } from "react";

import { slugifyName } from "@/lib/slugify";

interface SlugFieldProps {
  defaultName?: string;
  defaultSlug?: string;
  nameInputId?: string;
  inputClassName: string;
}

/**
 * Keeps the slug in sync with the name while the operator has not typed a custom slug.
 * Once they edit the slug field, auto-sync stops until the field is cleared.
 */
export function SlugField({
  defaultName = "",
  defaultSlug = "",
  nameInputId = "product-name",
  inputClassName,
}: SlugFieldProps) {
  const [slug, setSlug] = useState(defaultSlug || slugifyName(defaultName));
  const manual = useRef(Boolean(defaultSlug));

  useEffect(() => {
    const nameInput = document.getElementById(nameInputId) as HTMLInputElement | null;
    if (!nameInput) return;

    const onName = () => {
      if (manual.current) return;
      setSlug(slugifyName(nameInput.value));
    };

    nameInput.addEventListener("input", onName);
    return () => nameInput.removeEventListener("input", onName);
  }, [nameInputId]);

  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      URL amigable (slug)
      <input
        name="slug"
        value={slug}
        onChange={(event) => {
          manual.current = event.target.value.trim().length > 0;
          setSlug(event.target.value);
        }}
        placeholder="se-genera-solo"
        className={inputClassName}
      />
      <span className="text-xs font-semibold text-slate-500">
        Se completa solo desde el nombre. Solo tocá este campo si necesitás una URL distinta.
      </span>
    </label>
  );
}
