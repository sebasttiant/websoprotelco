"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Container } from "@/components/ui/container";
import { isSafeDesignLink } from "@/domains/design/schemas";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  imagePath: string;
  linkUrl: string | null;
}

export function HeroCarousel({ slides }: { slides: readonly HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  const isNavigable = slides.length > 1;
  const slide = slides[index];
  const linkUrl = isSafeDesignLink(slide.linkUrl) ? slide.linkUrl : null;

  function step(offset: number) {
    setIndex((current) => (current + offset + slides.length) % slides.length);
  }

  return (
    <section
      aria-label="Banners destacados"
      aria-roledescription="carrusel"
      className="relative overflow-hidden border-b border-brand-line bg-brand-navy text-white"
    >
      <Image
        key={slide.id}
        src={slide.imagePath}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-35 transition duration-700 ease-out motion-reduce:transition-none"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/85 to-brand-navy/40" />

      <Container className="relative flex min-h-[20rem] flex-col justify-center gap-5 py-14 sm:py-16 lg:min-h-[24rem]">
        <div key={slide.id} className="max-w-2xl animate-[fade-up_0.7s_ease-out] space-y-4 motion-reduce:animate-none">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {slide.title}
          </h1>
          {slide.subtitle ? (
            <p className="max-w-xl text-base font-medium leading-7 text-blue-100/85">{slide.subtitle}</p>
          ) : null}
          {linkUrl ? (
            <Link
              href={linkUrl}
              className="inline-flex rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-ice"
            >
              Ver más
            </Link>
          ) : null}
        </div>

        {isNavigable ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Banner anterior"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/25 text-lg transition hover:bg-white/10"
            >
              <span aria-hidden="true">&#8249;</span>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Banner siguiente"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/25 text-lg transition hover:bg-white/10"
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
                      position === index ? "w-7 bg-white" : "w-2 bg-white/35 hover:bg-white/60"
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
