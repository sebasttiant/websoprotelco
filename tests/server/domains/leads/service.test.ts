// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import {
  addLeadNote,
  assignLead,
  createLead,
  getLead,
  getLeadNotes,
  getLeads,
  updateLeadStatus,
} from "@/domains/leads/service";

const leadId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

const createInput = {
  name: "Jane Buyer",
  email: "jane@example.test",
  phone: "+57 300 000 0000",
  subject: "Cotización de Productos",
  message: "Necesito una cotización para fibra óptica.",
} as const;

describe("createLead", () => {
  test("inserts a lead defaulting the source to contact_form", async () => {
    mockQuery.mockResolvedValue([]);

    await createLead(createInput);

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO leads");
    expect(values).toContain("contact_form");
  });

  test("accepts an explicit source", async () => {
    mockQuery.mockResolvedValue([]);

    await createLead(createInput, "manual");

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toContain("manual");
  });
});

describe("getLeads", () => {
  test("maps a lead row to camelCase", async () => {
    mockQuery.mockResolvedValue([
      {
        id: leadId,
        name: "Jane Buyer",
        email: "jane@example.test",
        phone: null,
        subject: null,
        message: "Necesito fibra óptica.",
        source: "contact_form",
        status: "new",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const [lead] = await getLeads();

    expect(lead).toEqual({
      id: leadId,
      name: "Jane Buyer",
      email: "jane@example.test",
      phone: null,
      subject: null,
      message: "Necesito fibra óptica.",
      source: "contact_form",
      status: "new",
      assignedTo: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("filters by status when provided", async () => {
    mockQuery.mockResolvedValue([]);

    await getLeads("new");

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE status = $1");
    expect(values).toEqual(["new"]);
  });

  test("issues no WHERE clause without a status filter", async () => {
    mockQuery.mockResolvedValue([]);

    await getLeads();

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).not.toContain("WHERE");
  });
});

describe("getLead", () => {
  test("returns null when the lead does not exist", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getLead(leadId)).toBeNull();
  });

  test("maps an existing lead to camelCase", async () => {
    mockQuery.mockResolvedValue([
      {
        id: leadId,
        name: "Jane Buyer",
        email: "jane@example.test",
        phone: null,
        subject: null,
        message: "Necesito fibra óptica.",
        source: "contact_form",
        status: "new",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const lead = await getLead(leadId);

    expect(lead?.id).toBe(leadId);
  });
});

describe("updateLeadStatus", () => {
  test("updates the lead status", async () => {
    mockQuery.mockResolvedValue([]);

    await updateLeadStatus({ id: leadId, status: "contacted" });

    expect(mockQuery).toHaveBeenCalledWith("UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1", [
      leadId,
      "contacted",
    ]);
  });
});

describe("assignLead", () => {
  test("assigns the lead to a staff member", async () => {
    mockQuery.mockResolvedValue([]);

    await assignLead({ id: leadId, assignedTo: userId });

    expect(mockQuery).toHaveBeenCalledWith("UPDATE leads SET assigned_to = $2, updated_at = NOW() WHERE id = $1", [
      leadId,
      userId,
    ]);
  });

  test("un-assigns the lead when assignedTo is null", async () => {
    mockQuery.mockResolvedValue([]);

    await assignLead({ id: leadId, assignedTo: null });

    expect(mockQuery).toHaveBeenCalledWith("UPDATE leads SET assigned_to = $2, updated_at = NOW() WHERE id = $1", [
      leadId,
      null,
    ]);
  });
});

describe("addLeadNote", () => {
  test("stores a note bound to the acting user", async () => {
    mockQuery.mockResolvedValue([]);

    await addLeadNote({ leadId, note: "Called the customer back." }, userId);

    expect(mockQuery).toHaveBeenCalledWith("INSERT INTO lead_notes (lead_id, user_id, note) VALUES ($1, $2, $3)", [
      leadId,
      userId,
      "Called the customer back.",
    ]);
  });
});

describe("getLeadNotes", () => {
  test("maps note rows to camelCase", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        lead_id: leadId,
        user_id: userId,
        note: "Called the customer back.",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const [note] = await getLeadNotes(leadId);

    expect(note).toEqual({
      id: "44444444-4444-4444-8444-444444444444",
      leadId,
      userId,
      note: "Called the customer back.",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
