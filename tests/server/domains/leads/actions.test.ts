// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRedirect, mockRequirePermission, mockQuery, mockRevalidatePath } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
  mockRequirePermission: vi.fn(),
  mockQuery: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { addLeadNote, assignLead, createLead, updateLeadStatus } from "@/domains/leads/actions";

const adminId = "11111111-1111-4111-8111-111111111111";
const leadId = "33333333-3333-4333-8333-333333333333";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("public lead creation", () => {
  test("an unauthenticated visitor can submit the contact form without any permission guard", async () => {
    mockQuery.mockResolvedValue([]);

    await expect(
      createLead(
        formData({
          name: "Jane Buyer",
          email: "jane@example.test",
          phone: "+57 300 000 0000",
          subject: "Cotización de Productos",
          message: "Necesito una cotización para fibra óptica.",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/contacto?sent=1");

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO leads");
    expect(values).toContain("contact_form");
  });

  test("rejects invalid contact form input without inserting a lead", async () => {
    await expect(
      createLead(
        formData({
          name: "",
          email: "not-an-email",
          message: "",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/contacto?error=validation");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("admin lead status update", () => {
  test("requires the leads:write permission before writing", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(updateLeadStatus(formData({ id: leadId, status: "contacted" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("leads:write");
    expect(mockQuery).toHaveBeenCalledWith("UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1", [
      leadId,
      "contacted",
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/leads");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/leads?success=lead-updated");
  });
});

describe("admin lead assignment", () => {
  test("requires the leads:write permission and assigns the lead", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(assignLead(formData({ id: leadId, assignedTo: adminId }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("leads:write");
    expect(mockQuery).toHaveBeenCalledWith("UPDATE leads SET assigned_to = $2, updated_at = NOW() WHERE id = $1", [
      leadId,
      adminId,
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/leads");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/leads?success=lead-updated");
  });
});

describe("admin lead note", () => {
  test("stores a note bound to the acting user and redirects to the lead detail page", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(addLeadNote(formData({ leadId, note: "Called the customer back." }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockRequirePermission).toHaveBeenCalledWith("leads:write");
    expect(mockQuery).toHaveBeenCalledWith("INSERT INTO lead_notes (lead_id, user_id, note) VALUES ($1, $2, $3)", [
      leadId,
      adminId,
      "Called the customer back.",
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/leads/${leadId}`);
    expect(mockRedirect).toHaveBeenCalledWith(`/admin/leads/${leadId}?success=note-added`);
  });

  test("returns a validation error for an empty note and never writes", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await addLeadNote(formData({ leadId, note: "" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
