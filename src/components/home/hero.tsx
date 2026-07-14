import Image from "next/image";
import Link from "next/link";

import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import { Container } from "@/components/ui/container";
import { getHeroSettings, getPublicBanners } from "@/domains/design";

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

  // No banners configured: the hero still comes from the design domain, which supplies its
  // own defaults, so nothing here is hardcoded copy.
  return (
    <section className="relative overflow-hidden bg-brand-navy py-24 text-white lg:py-32">
      {settings.backgroundImage ? (
        <Image
          src={settings.backgroundImage}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
      ) : (
        <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/3 rounded-full bg-brand-blue opacity-30 blur-3xl" />
      )}

      <Container className="relative grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
        <div className="space-y-8 text-center lg:text-left">
          <p className="inline-flex rounded-full bg-white/10 px-5 py-2 text-xs font-black uppercase tracking-widest text-brand-accent backdrop-blur">
            Fibra Óptica · Conectividad · Infraestructura
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            {settings.title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg font-medium leading-8 text-blue-100/80 lg:mx-0">
            {settings.subtitle}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
            <Link
              href={settings.ctaLink}
              className="rounded-2xl bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-glow transition hover:bg-brand-primary"
            >
              {settings.ctaText}
            </Link>
            <Link
              href="/contacto"
              className="rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-sm font-black uppercase tracking-widest text-white backdrop-blur transition hover:bg-white hover:text-brand-blue"
            >
              Hablar con un asesor
            </Link>
          </div>
        </div>

        <div className="rounded-[40px] border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black">Asesoría para tu proyecto</h2>
          <p className="mt-4 text-sm font-medium leading-7 text-blue-100/80">
            Cuéntanos si necesitas fusionadoras, cableado, conectores, medición o diseño de red. Te ayudamos a elegir la solución correcta.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 p-4">
              <b className="block text-xl">+500</b>
              <span className="text-xs font-bold text-blue-100/60">referencias</span>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <b className="block text-xl">48h</b>
              <span className="text-xs font-bold text-blue-100/60">despachos</span>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <b className="block text-xl">B2B</b>
              <span className="text-xs font-bold text-blue-100/60">soporte</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
