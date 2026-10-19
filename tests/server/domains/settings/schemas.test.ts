// @vitest-environment node
import { describe, expect, test } from "vitest";

import { settingUpdateInputSchema } from "@/domains/settings/schemas";

describe("settingUpdateInputSchema", () => {
  test("parses a valid key/value pair", () => {
    const result = settingUpdateInputSchema.parse({ key: "site_name", value: "SOPROTELCO SAS" });

    expect(result).toEqual({ key: "site_name", value: "SOPROTELCO SAS" });
  });

  test("rejects a key with invalid characters", () => {
    const result = settingUpdateInputSchema.safeParse({ key: "Site-Name!", value: "SOPROTELCO" });

    expect(result.success).toBe(false);
  });

  test("rejects an unknown setting key even if snake_case", () => {
    const result = settingUpdateInputSchema.safeParse({ key: "secret_token", value: "x" });

    expect(result.success).toBe(false);
  });

  test("allows an empty value for a non-email setting", () => {
    const result = settingUpdateInputSchema.parse({ key: "facebook_url", value: "" });

    expect(result).toEqual({ key: "facebook_url", value: "" });
  });

  test("requires a valid email format when key is contact_email", () => {
    const result = settingUpdateInputSchema.safeParse({ key: "contact_email", value: "not-an-email" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("A valid email is required for contact_email.");
    }
  });

  test("accepts a valid email for contact_email", () => {
    const result = settingUpdateInputSchema.parse({ key: "contact_email", value: "ventas@soprotelco.com" });

    expect(result).toEqual({ key: "contact_email", value: "ventas@soprotelco.com" });
  });

  test("allows an empty value for contact_email (no email required when clearing)", () => {
    const result = settingUpdateInputSchema.parse({ key: "contact_email", value: "" });

    expect(result).toEqual({ key: "contact_email", value: "" });
  });

  test("rejects a social URL that is not http(s)", () => {
    const result = settingUpdateInputSchema.safeParse({ key: "instagram_url", value: "javascript:alert(1)" });

    expect(result.success).toBe(false);
  });

  test("accepts an https social URL", () => {
    const result = settingUpdateInputSchema.parse({
      key: "facebook_url",
      value: "https://facebook.com/soprotelco",
    });

    expect(result).toEqual({ key: "facebook_url", value: "https://facebook.com/soprotelco" });
  });

  test("rejects a WhatsApp number without enough digits", () => {
    const result = settingUpdateInputSchema.safeParse({ key: "whatsapp_number", value: "123" });

    expect(result.success).toBe(false);
  });

  test("accepts a WhatsApp number with country code", () => {
    const result = settingUpdateInputSchema.parse({ key: "whatsapp_number", value: "+573001234567" });

    expect(result).toEqual({ key: "whatsapp_number", value: "+573001234567" });
  });
});
