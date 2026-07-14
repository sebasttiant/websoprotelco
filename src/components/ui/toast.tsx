"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const TOAST_MESSAGES: Readonly<Record<string, string>> = {
  "product-created": "Product created successfully.",
  "product-updated": "Product updated successfully.",
  "product-deleted": "Product deleted successfully.",
  "category-created": "Category created successfully.",
  "category-updated": "Category updated successfully.",
  "category-deleted": "Category deleted successfully.",
  "quote-updated": "Quote status updated successfully.",
  "profile-updated": "Profile updated successfully.",
  "password-updated": "Password changed successfully.",
  "action-failed": "The operation could not be completed.",
};

function resolveToastMessage(success: string | null, error: string | null): { message: string; tone: "success" | "error" } | null {
  if (success) {
    return { message: TOAST_MESSAGES[success] ?? "Operation completed successfully.", tone: "success" };
  }

  if (error) {
    return { message: TOAST_MESSAGES[error] ?? "The operation could not be completed.", tone: "error" };
  }

  return null;
}

export function Toast() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const toast = resolveToastMessage(success, error);
  const toastKey = success ? `success:${success}` : error ? `error:${error}` : null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!toastKey) {
      return;
    }

    const timeout = window.setTimeout(() => setDismissedKey(toastKey), 3_000);

    return () => window.clearTimeout(timeout);
  }, [toastKey]);

  if (!toast || !toastKey || dismissedKey === toastKey) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-3xl bg-white p-4 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-200" role="status" aria-live="polite">
      <p className={toast.tone === "success" ? "text-sm font-black text-emerald-700" : "text-sm font-black text-red-700"}>{toast.message}</p>
    </div>
  );
}
