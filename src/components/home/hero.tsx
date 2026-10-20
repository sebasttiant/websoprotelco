import Image from "next/image";
import Link from "next/link";

import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import { Container } from "@/components/ui/container";
import { getHeroSettings, getPublicBanners } from "@/domains/design";
import { isSafeDesignLink } from "@/domains/design/schemas";

/** Default field photo when admin has not uploaded a hero background yet. */
const DEFAULT_HERO_IMAGE = "/assets/img/hero-fiber.jpg";

export async function Hero() {
  const [banners, settings] = await Promise.all([getPublicBanners(), getHeroSettings()]);

  if (banners.length > 0) {
    const slides: HeroSlide[] = banners.map((banner) => ({
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      imagePath: banner.imagePath,
      linkUrl: banner.linkUrl,
    }));

    return <HeroCarousel slides={slides} />;
  }

  const heroImage = settings.backgroundImage ?? DEFAULT_HERO_IMAGE;

  // White page surface under the sticky navy header. Split: copy left, photo right.
  return (
    <section className="relative overflow-hidden border-b border-brand-line bg-white">
      <div className="grid lg:grid-cols-2 lg:items-stretch">
        <Container className="relative flex max-w-3xl flex-col justify-center py-14 sm:py-16 lg:max-w-none lg:py-20">
          <div className="max-w-xl motion-safe:animate-[fade-up_0.7s_ease-out] motion-reduce:animate-none">
            <p className="mb-4 text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">
              Fibra Óptica · Conectividad · Infraestructura
            </p>
            <h1 className="text-balance text-2xl font-black leading-snug tracking-tight text-brand-navy sm:text-3xl lg:text-4xl lg:leading-tight">
              {settings.title}
            </h1>
            <p className="mt-5 text-sm font-medium leading-6 text-brand-muted sm:text-base sm:leading-7">
              {settings.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={isSafeDesignLink(settings.ctaLink) ? settings.ctaLink : "/productos"}
                className="inline-flex items-center justify-center rounded-xl bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
              >
                {settings.ctaText}
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center justify-center rounded-xl border border-brand-line bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
              >
                Hablar con un asesor
              </Link>
            </div>
          </div>
        </Container>

        <div className="relative min-h-[14rem] sm:min-h-[18rem] lg:min-h-[22rem]">
          <Image
            src={heroImage}
            alt="Técnico de fibra óptica empalmando cable en campo"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover motion-safe:animate-[hero-drift_22s_ease-in-out_infinite] motion-reduce:animate-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-white to-transparent lg:block"
          />
        </div>
      </div>

      {/* Animated fiber signal: a pulse travels the line, echoing a live link.
          Purely decorative; frozen for reduced-motion users. */}
      <div
        data-signal-line
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-brand-accent/60 to-transparent"
      >
        <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-accent shadow-glow motion-safe:animate-[fiber-pulse_3.2s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>
    </section>
  );
}
