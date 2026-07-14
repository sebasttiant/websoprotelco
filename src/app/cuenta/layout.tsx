import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

// The account pages sat outside the site chrome, so a signed-in customer lost the header and
// footer the moment they left the storefront. This restores it across all of /cuenta.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <div className="min-h-[60vh] bg-brand-ice">{children}</div>
      <Footer />
    </>
  );
}
