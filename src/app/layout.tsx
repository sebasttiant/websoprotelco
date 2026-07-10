import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { Toast } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "SOPROTELCO",
  description: "SOPROTELCO ecommerce rebuild foundation.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Suspense fallback={null}>
          <Toast />
        </Suspense>
      </body>
    </html>
  );
}
