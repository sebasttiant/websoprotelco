"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import {
  leadAssignInputSchema,
  leadCreateInputSchema,
  leadNoteInputSchema,
  leadStatusUpdateInputSchema,
} from "./schemas";
import * as leadsService from "./service";

export interface LeadsActionState {
  success: boolean;
  message: string;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function stringValue(formData: FormData, key: string): string {
  const value = formValue(formData, key);
  return typeof value === "string" ? value : "";
}

function errorState(error: unknown): LeadsActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Leads action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

// Public entry point behind the "/contacto" form. Reachable by unauthenticated visitors,
// so it must never gain a requirePermission guard.
export async function createLead(formData: FormData): Promise<void> {
  const parsed = leadCreateInputSchema.safeParse({
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    phone: stringValue(formData, "phone"),
    subject: stringValue(formData, "subject"),
    message: stringValue(formData, "message"),
  });

  if (!parsed.success) {
    redirect("/contacto?error=validation");
  }

  await leadsService.createLead(parsed.data, "contact_form");

  redirect("/contacto?sent=1");
}

// Admin-only mutation: requires the "leads:write" permission before touching anything else.
export async function updateLeadStatus(formData: FormData): Promise<LeadsActionState> {
  await requirePermission("leads:write");

  try {
    const input = leadStatusUpdateInputSchema.parse({
      id: formValue(formData, "id"),
      status: formValue(formData, "status"),
    });

    await leadsService.updateLeadStatus(input);
    revalidatePath("/admin/leads");
    redirect("/admin/leads?success=lead-updated");
  } catch (error) {
    return errorState(error);
  }
}

export async function assignLead(formData: FormData): Promise<LeadsActionState> {
  await requirePermission("leads:write");

  try {
    const input = leadAssignInputSchema.parse({
      id: formValue(formData, "id"),
      assignedTo: stringValue(formData, "assignedTo"),
    });

    await leadsService.assignLead(input);
    revalidatePath("/admin/leads");
    redirect("/admin/leads?success=lead-updated");
  } catch (error) {
    return errorState(error);
  }
}

export async function addLeadNote(formData: FormData): Promise<LeadsActionState> {
  const user = await requirePermission("leads:write");

  try {
    const input = leadNoteInputSchema.parse({
      leadId: formValue(formData, "leadId"),
      note: formValue(formData, "note"),
    });

    await leadsService.addLeadNote(input, user.id);
    revalidatePath(`/admin/leads/${input.leadId}`);
    redirect(`/admin/leads/${input.leadId}?success=note-added`);
  } catch (error) {
    return errorState(error);
  }
}
