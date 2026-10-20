import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { Suspense, type ReactNode } from "react";

import { Toast } from "@/components/ui/toast";
import { publicSiteUrl } from "@/lib/site-url";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
  variable: "--font-sora",
});

const DESCRIPTION =
  "Compra y venta de equipos de fibra óptica en Colombia: fusionadoras, cortadoras, conversores, kits y conectores. Asesoría técnica y despachos nacionales.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await publicSiteUrl()),
    title: {
      default: "Equipos de fibra óptica y conectividad",
      template: "%s | SOPROTELCO",
    },
    description: DESCRIPTION,
    applicationName: "SOPROTELCO",
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: "SOPROTELCO",
      title: "SOPROTELCO | Equipos de fibra óptica y conectividad",
      description: DESCRIPTION,
    },
    twitter: { card: "summary_large_image", title: "SOPROTELCO", description: DESCRIPTION },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-white text-brand-ink antialiased">
        {children}
        <Suspense fallback={null}>
          <Toast />
        </Suspense>
      </body>
    </html>
  );
}
