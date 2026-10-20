import { CartContent } from "@/components/cart/cart-content";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/domains/settings";

// The page reads site settings from the database, so it can never be prerendered:
// without this, the Docker build (which has no DATABASE_URL) tries to export it
// statically and fails. Every other data-backed page declares the same.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const settings = await getSiteSettings();

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <Container className="py-12">
        <nav aria-label="Ruta de navegación" className="mb-8 text-sm font-bold text-brand-muted">
          Inicio / Carrito
        </nav>
        <h1 className="mb-3 text-4xl font-black text-brand-navy">Tu carrito</h1>
        <p className="mb-8 text-brand-muted">Revisa los productos, deja tus datos y confirma tu pedido.</p>
        <CartContent whatsappNumber={settings.whatsappNumber} />
      </Container>
      <Footer />
    </main>
  );
}
