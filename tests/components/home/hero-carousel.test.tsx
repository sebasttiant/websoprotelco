import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";

const SLIDES: HeroSlide[] = [
  { id: "a", title: "Primero", subtitle: "Uno", imagePath: "/uploads/banners/a.jpg", linkUrl: "/productos" },
  { id: "b", title: "Segundo", subtitle: null, imagePath: "/uploads/banners/b.jpg", linkUrl: null },
  { id: "c", title: "Tercero", subtitle: "Tres", imagePath: "/uploads/banners/c.jpg", linkUrl: null },
];

function renderCarousel(slides: HeroSlide[] = SLIDES) {
  render(<HeroCarousel slides={slides} />);
  return {
    user: userEvent.setup(),
    next: () => screen.getByRole("button", { name: /siguiente/i }),
    prev: () => screen.getByRole("button", { name: /anterior/i }),
    dot: (n: number) => screen.getByRole("button", { name: `Ir al banner ${n}` }),
    heading: () => screen.getByRole("heading", { level: 1 }),
  };
}

describe("HeroCarousel", () => {
  test("opens on the first slide", () => {
    const { heading } = renderCarousel();

    expect(heading()).toHaveTextContent("Primero");
  });

  test("advances to the next slide", async () => {
    const { user, next, heading } = renderCarousel();

    await user.click(next());

    expect(heading()).toHaveTextContent("Segundo");
  });

  test("wraps around from the last slide back to the first", async () => {
    const { user, next, heading } = renderCarousel();

    await user.click(next());
    await user.click(next());
    await user.click(next());

    expect(heading()).toHaveTextContent("Primero");
  });

  test("wraps backwards from the first slide to the last", async () => {
    const { user, prev, heading } = renderCarousel();

    await user.click(prev());

    expect(heading()).toHaveTextContent("Tercero");
  });

  test("jumps straight to a slide from its dot", async () => {
    const { user, dot, heading } = renderCarousel();

    await user.click(dot(3));

    expect(heading()).toHaveTextContent("Tercero");
  });

  test("marks the active dot for assistive technology", async () => {
    const { user, dot } = renderCarousel();

    expect(dot(1)).toHaveAttribute("aria-current", "true");

    await user.click(dot(2));

    expect(dot(2)).toHaveAttribute("aria-current", "true");
    expect(dot(1)).not.toHaveAttribute("aria-current", "true");
  });

  test("links the slide when the banner carries a URL", async () => {
    renderCarousel();

    expect(screen.getByRole("link", { name: /ver más/i })).toHaveAttribute("href", "/productos");
  });

  test("omits the link when the banner has none", async () => {
    const { user, next } = renderCarousel();

    await user.click(next());

    expect(screen.queryByRole("link", { name: /ver más/i })).not.toBeInTheDocument();
  });

  test("hides the controls for a single banner, where they would do nothing", () => {
    render(<HeroCarousel slides={[SLIDES[0]]} />);

    expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ir al banner/i })).not.toBeInTheDocument();
  });
});
