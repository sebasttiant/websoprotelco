import { CartContent } from "@/components/cart/cart-content";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";

export default function CartPage() {
  return <main className="min-h-screen bg-brand-ice"><Header /><Container className="py-12"><nav aria-label="Ruta de navegación" className="mb-8 text-sm font-bold text-brand-muted">Inicio / Carrito</nav><h1 className="mb-3 text-4xl font-black text-brand-navy">Tu carrito</h1><p className="mb-8 text-brand-muted">Revisa los productos antes de preparar una cotización.</p><CartContent /></Container><Footer /></main>;
}
