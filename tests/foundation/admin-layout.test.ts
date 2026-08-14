import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const adminLayout = readFileSync(resolve(process.cwd(), "src/app/admin/layout.tsx"), "utf8");

describe("admin shell layout", () => {
  // A source assertion, deliberately. The property it guards is a CSS grid sizing rule, and jsdom
  // implements no layout, so no component test in this suite can observe it: reverting the fix
  // leaves all of them green. Verified in a real browser instead — at 820px the document scrolled
  // to 832px wide with `1fr` and stays at 820px with `minmax(0,1fr)`.
  //
  // The rule itself: a track sized `1fr` still carries an implicit `min-width: auto`, so it will
  // not shrink below the intrinsic width of its content. A wide admin table therefore widened the
  // track and scrolled the whole page sideways, while the `overflow-x-auto` the table component
  // already provides never got the chance to engage.
  test("sizes the content column so a wide table cannot widen the page", () => {
    expect(adminLayout).toContain("md:grid-cols-[15rem_minmax(0,1fr)]");
    expect(adminLayout).not.toContain("md:grid-cols-[15rem_1fr]");
  });
});
