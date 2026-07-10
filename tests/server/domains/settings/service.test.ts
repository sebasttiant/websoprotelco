// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { getAllSettings, updateSetting } from "@/domains/settings/service";

const adminId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAllSettings", () => {
  test("orders settings by key ascending", async () => {
    mockQuery.mockResolvedValue([]);

    await getAllSettings();

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("ORDER BY key ASC");
  });

  test("maps a row into a SettingSummary", async () => {
    mockQuery.mockResolvedValue([
      {
        id: adminId,
        key: "site_name",
        value: "SOPROTELCO",
        description: "Site display name",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const [setting] = await getAllSettings();

    expect(setting).toEqual({
      id: adminId,
      key: "site_name",
      value: "SOPROTELCO",
      description: "Site display name",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("returns an empty array when there are no settings", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getAllSettings()).toEqual([]);
  });
});

describe("updateSetting", () => {
  test("updates the value and records the updating admin", async () => {
    mockQuery.mockResolvedValue([]);

    await updateSetting({ key: "site_name", value: "SOPROTELCO SAS" }, adminId);

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE key = $1");
    expect(values).toEqual(["site_name", "SOPROTELCO SAS", adminId]);
  });
});
