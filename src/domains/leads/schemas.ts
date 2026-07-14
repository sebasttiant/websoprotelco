import { z } from "zod";

// --- Lead source and status ---------------------------------------------------

export const LEAD_SOURCES = ["contact_form", "whatsapp", "manual", "other"] as const;

export const leadSourceSchema = z.enum(LEAD_SOURCES);

export type LeadSource = z.infer<typeof leadSourceSchema>;

export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;

export const leadStatusSchema = z.enum(LEAD_STATUSES);

export type LeadStatus = z.infer<typeof leadStatusSchema>;

// --- Read models ----------------------------------------------------------------

export const leadSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  subject: z.string().nullable(),
  message: z.string(),
  source: z.string(),
  status: z.string(),
  assignedTo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LeadSummary = z.infer<typeof leadSummarySchema>;

export const leadNoteSchema = z.object({
  id: z.uuid(),
  leadId: z.uuid(),
  userId: z.string().nullable(),
  note: z.string(),
  createdAt: z.string(),
});

export type LeadNote = z.infer<typeof leadNoteSchema>;

// --- Public contact form submission ---------------------------------------------

export const leadCreateInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }).max(200),
  email: z.email({ error: "A valid email is required." }).max(255),
  phone: z.string().trim().max(50).optional(),
  subject: z.string().trim().max(300).optional(),
  message: z.string().trim().min(1, { error: "Message is required." }).max(2_000),
});

export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>;

// --- Admin mutation input --------------------------------------------------------

export const leadStatusUpdateInputSchema = z.object({
  id: z.uuid(),
  status: leadStatusSchema,
});

export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateInputSchema>;

// Empty string un-assigns the lead: the assignee select allows a blank option that
// is transformed into NULL rather than rejected as an invalid uuid.
export const leadAssignInputSchema = z.object({
  id: z.uuid(),
  assignedTo: z.union([z.uuid(), z.literal("")]).transform((value) => (value === "" ? null : value)),
});

export type LeadAssignInput = z.infer<typeof leadAssignInputSchema>;

export const leadNoteInputSchema = z.object({
  leadId: z.uuid(),
  note: z.string().trim().min(1, { error: "Note is required." }),
});

export type LeadNoteInput = z.infer<typeof leadNoteInputSchema>;
