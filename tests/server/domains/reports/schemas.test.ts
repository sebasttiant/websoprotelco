// @vitest-environment node
import { describe, expect, test } from "vitest";

import { isReportRange, rangeStartDate } from "@/domains/reports/schemas";

describe("report range helpers", () => {
  test("accepts known ranges only", () => {
    expect(isReportRange("30")).toBe(true);
    expect(isReportRange("all")).toBe(true);
    expect(isReportRange("15")).toBe(false);
  });

  test("all-time has no lower bound", () => {
    expect(rangeStartDate("all")).toBeNull();
  });

  test("30-day range starts 29 days before the given UTC midnight", () => {
    const now = new Date("2026-10-19T15:00:00.000Z");
    const start = rangeStartDate("30", now);

    expect(start?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });
});
