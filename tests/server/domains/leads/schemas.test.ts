// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  leadAssignInputSchema,
  leadCreateInputSchema,
  leadNoteInputSchema,
  leadStatusUpdateInputSchema,
} from "@/domains/leads/schemas";

const leadId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";

describe("leadCreateInputSchema", () => {
  test("accepts a well-formed contact form submission", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "Jane Buyer",
      email: "jane@example.test",
      phone: "+57 300 000 0000",
      subject: "Cotización de Productos",
      message: "Necesito una cotización para fibra óptica.",
    });

    expect(result.success).toBe(true);
  });

  test("accepts a submission without the optional phone and subject", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "Jane Buyer",
      email: "jane@example.test",
      message: "Necesito una cotización para fibra óptica.",
    });

    expect(result.success).toBe(true);
  });

  test("rejects a missing name", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "",
      email: "jane@example.test",
      message: "Necesito una cotización.",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Name is required.");
    }
  });

  test("rejects an invalid email", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "Jane Buyer",
      email: "not-an-email",
      message: "Necesito una cotización.",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("A valid email is required.");
    }
  });

  test("rejects an empty message", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "Jane Buyer",
      email: "jane@example.test",
      message: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Message is required.");
    }
  });

  test("rejects an over-long message so the unauthenticated endpoint cannot be used to exhaust storage", () => {
    const result = leadCreateInputSchema.safeParse({
      name: "Jane Buyer",
      email: "jane@example.test",
      message: "x".repeat(2_001),
    });

    expect(result.success).toBe(false);
  });
});

describe("leadStatusUpdateInputSchema", () => {
  test("accepts a known status", () => {
    const result = leadStatusUpdateInputSchema.safeParse({ id: leadId, status: "contacted" });

    expect(result.success).toBe(true);
  });

  test("rejects an unknown status", () => {
    const result = leadStatusUpdateInputSchema.safeParse({ id: leadId, status: "archived" });

    expect(result.success).toBe(false);
  });
});

describe("leadAssignInputSchema", () => {
  test("accepts a uuid assignee", () => {
    const result = leadAssignInputSchema.parse({ id: leadId, assignedTo: userId });

    expect(result).toEqual({ id: leadId, assignedTo: userId });
  });

  test("transforms an empty string into null to un-assign", () => {
    const result = leadAssignInputSchema.parse({ id: leadId, assignedTo: "" });

    expect(result).toEqual({ id: leadId, assignedTo: null });
  });

  test("rejects a non-uuid, non-empty assignee", () => {
    const result = leadAssignInputSchema.safeParse({ id: leadId, assignedTo: "not-a-uuid" });

    expect(result.success).toBe(false);
  });
});

describe("leadNoteInputSchema", () => {
  test("accepts a well-formed note", () => {
    const result = leadNoteInputSchema.safeParse({ leadId, note: "Called the customer back." });

    expect(result.success).toBe(true);
  });

  test("rejects an empty note", () => {
    const result = leadNoteInputSchema.safeParse({ leadId, note: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Note is required.");
    }
  });
});
