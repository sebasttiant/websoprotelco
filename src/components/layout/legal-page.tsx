import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  intro: string;
  updatedAt: string;
  sections: readonly LegalSection[];
}

export function LegalPage({ title, intro, updatedAt, sections }: LegalPageProps) {
  return (
    <>
      <Header />
      <main className="bg-brand-ice py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Legal</p>
          <h1 className="mt-2 text-4xl font-black text-brand-navy">{title}</h1>
          <p className="mt-4 text-base font-medium leading-8 text-brand-muted">{intro}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Última actualización: {updatedAt}
          </p>

          <div className="mt-10 space-y-8 rounded-[32px] bg-white p-8 shadow-xl shadow-blue-950/5">
            {sections.map((section, index) => (
              <section key={section.heading}>
                <h2 className="text-xl font-black text-brand-navy">
                  {index + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-sm font-medium leading-7 text-brand-muted">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
