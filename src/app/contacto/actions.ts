"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { query } from "@/server/db/pool";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  phone: z.string().trim().min(7).max(50),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(2_000),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function createReference(): string {
  return `WEB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function submitContactRequest(formData: FormData): Promise<void> {
  const parsed = contactSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    subject: formValue(formData, "subject"),
    message: formValue(formData, "message"),
  });

  if (!parsed.success) {
    redirect("/contacto?error=validation");
  }

  await query(
    `INSERT INTO quote_requests (reference, contact_name, contact_email, contact_phone, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      createReference(),
      parsed.data.name,
      parsed.data.email,
      parsed.data.phone,
      `[${parsed.data.subject}] ${parsed.data.message}`,
    ],
  );

  redirect("/contacto?sent=1");
}
