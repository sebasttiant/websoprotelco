// @vitest-environment node
import { describe, expect, test } from "vitest";

import { hasPermission, isRole, type Permission, type Role } from "../../../src/server/auth/rbac";

describe("isRole", () => {
  test.each(["admin", "staff"])("accepts %s", (value) => {
    expect(isRole(value)).toBe(true);
  });

  test.each(["superuser", "", null, undefined, 1])("rejects %s", (value) => {
    expect(isRole(value)).toBe(false);
  });
});

describe("hasPermission", () => {
  test("admin has admin:access", () => {
    expect(hasPermission("admin", "admin:access")).toBe(true);
  });

  test("admin has catalog:write", () => {
    expect(hasPermission("admin", "catalog:write")).toBe(true);
  });

  test("staff has catalog:read", () => {
    expect(hasPermission("staff", "catalog:read")).toBe(true);
  });

  test("staff has quote:write", () => {
    expect(hasPermission("staff", "quote:write")).toBe(true);
  });

  test("staff does NOT have admin:access", () => {
    expect(hasPermission("staff", "admin:access")).toBe(false);
  });

  test("staff does NOT have catalog:write", () => {
    expect(hasPermission("staff", "catalog:write")).toBe(false);
  });

  test("staff has leads:read", () => {
    expect(hasPermission("staff", "leads:read")).toBe(true);
  });

  test("staff has leads:write", () => {
    expect(hasPermission("staff", "leads:write")).toBe(true);
  });

  test("admin has leads:read and leads:write", () => {
    expect(hasPermission("admin", "leads:read")).toBe(true);
    expect(hasPermission("admin", "leads:write")).toBe(true);
  });

  test("fails closed for an unknown role", () => {
    const unknownRole = "superuser" as Role;

    expect(hasPermission(unknownRole, "catalog:read")).toBe(false);
  });

  test("fails closed for an unknown permission", () => {
    const unknownPermission = "billing:read" as Permission;

    expect(hasPermission("admin", unknownPermission)).toBe(false);
  });
});
