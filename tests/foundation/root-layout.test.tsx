import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

// `next/font/google` is rewritten by the Next compiler at build time. Under Vitest it runs in
// plain Node, so it has to be stubbed with the shape the loader would have produced.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "__inter_variable", className: "__inter_class" }),
}));

const { default: RootLayout } = await import("@/app/layout");

// The layout renders <html>/<body>, which cannot be mounted inside Testing Library's div
// container, so the returned element tree is asserted directly.
function renderHtmlElement(): ReactElement<{ lang?: string; className?: string }> {
  return RootLayout({ children: null }) as ReactElement<{ lang?: string; className?: string }>;
}

describe("root layout", () => {
  test("publishes the Inter font variable so the theme sans stack resolves", () => {
    expect(renderHtmlElement().props.className).toContain("__inter_variable");
  });

  test("keeps the document language as Spanish", () => {
    expect(renderHtmlElement().props.lang).toBe("es");
  });
});
