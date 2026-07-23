import { Container } from "@/components/ui/container";

export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-brand-ice" aria-busy="true">
      <Container className="py-32 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
        <p className="mt-5 font-bold text-brand-muted">Cargando catálogo...</p>
      </Container>
    </main>
  );
}
