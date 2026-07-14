"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Container } from "@/components/ui/container";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  imagePath: string;
  linkUrl: string | null;
}

export function HeroCarousel({ slides }: { slides: readonly HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  // With one banner the arrows and dots have nowhere to go, so they are not rendered.
  const isNavigable = slides.length > 1;
  const slide = slides[index];

  function step(offset: number) {
    setIndex((current) => (current + offset + slides.length) % slides.length);
  }

  return (
    <section
      aria-label="Banners destacados"
      aria-roledescription="carrusel"
      className="relative overflow-hidden bg-brand-navy text-white"
    >
      <Image
        key={slide.id}
        src={slide.imagePath}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/80 to-transparent" />

      <Container className="relative flex min-h-[28rem] flex-col justify-center gap-6 py-24 lg:min-h-[32rem]">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">{slide.title}</h1>
          {slide.subtitle ? (
            <p className="text-lg font-medium leading-8 text-blue-100/80">{slide.subtitle}</p>
          ) : null}
          {slide.linkUrl ? (
            <Link
              href={slide.linkUrl}
              className="inline-block rounded-2xl bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-glow transition hover:bg-brand-primary"
            >
              Ver más
            </Link>
          ) : null}
        </div>

        {isNavigable ? (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Banner anterior"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-lg transition hover:border-brand-accent hover:text-brand-accent"
            >
              <span aria-hidden="true">&#8249;</span>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Banner siguiente"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-lg transition hover:border-brand-accent hover:text-brand-accent"
            >
              <span aria-hidden="true">&#8250;</span>
            </button>

            <ul className="flex items-center gap-2">
              {slides.map((item, position) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={`Ir al banner ${position + 1}`}
                    aria-current={position === index ? "true" : undefined}
                    className={`block h-2 rounded-full transition-all ${
                      position === index ? "w-8 bg-brand-accent" : "w-2 bg-white/30 hover:bg-white/60"
                    }`}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
