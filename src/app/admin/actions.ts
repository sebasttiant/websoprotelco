"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";
import { query } from "@/server/db/pool";

import { QUOTE_STATUSES, type QuoteStatus } from "./quote-status";

export interface AdminActionState {
  success: boolean;
  message: string;
}

const terminalQuoteStatuses = new Set<QuoteStatus>(["won", "lost", "cancelled"]);

const quoteTransitions: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  received: ["in_review", "cancelled"],
  in_review: ["quoted", "lost", "cancelled"],
  quoted: ["won", "lost", "cancelled"],
  won: [],
  lost: [],
  cancelled: [],
};

const quoteStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(QUOTE_STATUSES),
});

interface QuoteStatusRow {
  status: QuoteStatus;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function errorState(error: unknown): AdminActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Admin action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

function redirectWithSuccess(pathname: string, code: string): never {
  redirect(`${pathname}?success=${code}`);
}

function redirectWithError(pathname: string, code = "action-failed"): never {
  redirect(`${pathname}?error=${code}`);
}

export async function updateQuoteStatus(formData: FormData): Promise<AdminActionState> {
  await requirePermission("quote:write");

  try {
    const input = quoteStatusSchema.parse({ id: formValue(formData, "id"), status: formValue(formData, "status") });
    const rows = await query<QuoteStatusRow>("SELECT status FROM quote_requests WHERE id = $1", [input.id]);
    const currentStatus = rows[0]?.status;

    if (!currentStatus) {
      redirectWithError("/admin/quotes");
    }

    if (currentStatus === input.status) {
      redirectWithSuccess("/admin/quotes", "quote-updated");
    }

    if (terminalQuoteStatuses.has(currentStatus) || !quoteTransitions[currentStatus].includes(input.status)) {
      redirectWithError("/admin/quotes");
    }

    await query("UPDATE quote_requests SET status = $2 WHERE id = $1", [input.id, input.status]);
    revalidatePath("/admin/quotes");
    redirectWithSuccess("/admin/quotes", "quote-updated");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/quotes");
  }
}
