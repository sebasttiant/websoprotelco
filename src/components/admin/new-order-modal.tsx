"use client";

import { Mail, Package, Phone, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// From ./actions, never the domain barrel: the barrel reaches the repository's
// `import "server-only"` and fails the client build. See the note in domains/quote-order/index.ts.
import { createAdminOrder, type CartOrderActionState } from "@/domains/quote-order/actions";
import { Portal } from "@/components/ui/portal";
import { formatCurrencyCents } from "@/lib/presentation";

export interface OrderProductOption {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  categoryName: string;
}

interface NewOrderModalProps {
  products: readonly OrderProductOption[];
}

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_FORM: CustomerForm = { name: "", email: "", phone: "", notes: "" };

const MAX_QUANTITY = 99;
const MAX_RESULTS = 8;

export function NewOrderModal({ products }: NewOrderModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<{ product: OrderProductOption; quantity: number }[]>([]);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Matching happens over the already-loaded catalog, so results appear as the operator types
  // with no round trip. Products already on the order drop out of the list — offering a line
  // that is present would only invite a duplicate.
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === "") return [];

    const chosen = new Set(lines.map((line) => line.product.id));

    return products
      .filter(
        (product) =>
          !chosen.has(product.id) &&
          (product.name.toLowerCase().includes(term) ||
            product.sku.toLowerCase().includes(term) ||
            product.categoryName.toLowerCase().includes(term)),
      )
      .slice(0, MAX_RESULTS);
  }, [products, search, lines]);

  // Indicative only. The authoritative total is computed server-side from the products table
  // when the order is written, and it is that figure the confirmation reports back.
  const previewTotalCents = lines.reduce((total, line) => total + line.product.priceCents * line.quantity, 0);

  const canSubmit =
    lines.length > 0 && form.name.trim().length >= 2 && form.email.includes("@") && form.phone.trim().length >= 7;

  function addProduct(product: OrderProductOption): void {
    setLines((current) => [...current, { product, quantity: 1 }]);
    setSearch("");
  }

  function setQuantity(id: string, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 1) return;

    const quantity = Math.min(parsed, MAX_QUANTITY);
    setLines((current) => current.map((line) => (line.product.id === id ? { ...line, quantity } : line)));
  }

  function removeLine(id: string): void {
    setLines((current) => current.filter((line) => line.product.id !== id));
  }

  function close(): void {
    setOpen(false);
    setSearch("");
    setLines([]);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submit(): Promise<void> {
    setPending(true);
    setError("");

    // Ids and quantities only. The price of every line is read from the products table on the
    // server, so the figure previewed above can never become the figure recorded.
    const state: CartOrderActionState = await createAdminOrder({
      name: form.name,
      email: form.email,
      phone: form.phone,
      notes: form.notes,
      items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    });

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    close();
    // The list is a server component, so it needs an explicit refresh to show the new row.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Nuevo pedido
      </button>

      {open ? (
        // Portalled for the same reason as the cart drawer: any ancestor with transform,
        // filter, backdrop-filter or contain becomes the containing block for a fixed child,
        // and the overlay silently stops covering the viewport. Escaping the subtree makes
        // this immune to whatever the admin layout grows later.
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo pedido"
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-brand-line px-7 py-5">
              <div>
                <h2 className="text-2xl font-black text-brand-navy">Nuevo pedido</h2>
                <p className="text-sm font-medium text-brand-muted">Agrega productos y datos del cliente</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="rounded-full p-2 text-brand-muted transition hover:bg-brand-ice hover:text-brand-navy"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-7 py-6">
              {error ? (
                <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </p>
              ) : null}

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-muted">
                  Buscar y agregar productos
                </h3>
                <div className="relative mt-2">
                  <Package aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nombre, SKU o categoría…"
                    aria-label="Buscar productos para agregar al pedido"
                    className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                  />
                </div>

                {search.trim() !== "" && results.length === 0 ? (
                  <p className="mt-3 text-sm font-bold text-brand-muted">Sin resultados para “{search.trim()}”.</p>
                ) : null}

                {results.length > 0 ? (
                  <ul className="mt-3 divide-y divide-brand-line overflow-hidden rounded-2xl border border-brand-line">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-brand-ice"
                        >
                          <span>
                            <span className="block font-black text-brand-navy">{product.name}</span>
                            <span className="block text-xs font-bold text-brand-muted">
                              {product.sku} · {product.categoryName}
                            </span>
                          </span>
                          <span className="shrink-0 font-black text-brand-blue">
                            {formatCurrencyCents(product.priceCents)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {lines.length > 0 ? (
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-brand-muted">Productos del pedido</h3>
                  <ul className="mt-2 space-y-3">
                    {lines.map((line) => (
                      <li
                        key={line.product.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black text-brand-navy">{line.product.name}</p>
                          <p className="text-xs font-bold text-brand-muted">
                            {formatCurrencyCents(line.product.priceCents)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label htmlFor={`order-qty-${line.product.id}`} className="sr-only">
                            Cantidad de {line.product.name}
                          </label>
                          <input
                            id={`order-qty-${line.product.id}`}
                            type="number"
                            min="1"
                            max={MAX_QUANTITY}
                            step="1"
                            value={line.quantity}
                            onChange={(event) => setQuantity(line.product.id, event.target.value)}
                            className="w-20 rounded-xl border border-brand-line px-3 py-2 text-center font-black text-brand-navy"
                          />
                          <button
                            type="button"
                            onClick={() => removeLine(line.product.id)}
                            aria-label={`Quitar ${line.product.name}`}
                            className="text-brand-blue transition hover:text-brand-navy"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-right text-sm font-bold text-brand-muted">
                    Total estimado:{" "}
                    <span className="text-lg font-black text-brand-navy">{formatCurrencyCents(previewTotalCents)}</span>
                  </p>
                </section>
              ) : null}

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-muted">Datos del cliente</h3>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      { key: "name", label: "Nombre", type: "text", placeholder: "Juan Pérez", Icon: User },
                      { key: "email", label: "Email", type: "email", placeholder: "juan@ejemplo.com", Icon: Mail },
                      { key: "phone", label: "Teléfono", type: "tel", placeholder: "300 123 4567", Icon: Phone },
                    ] as const
                  ).map(({ key, label, type, placeholder, Icon }) => (
                    <div key={key}>
                      <label htmlFor={`order-${key}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                        {label}
                      </label>
                      <div className="relative mt-1.5">
                        <Icon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                        <input
                          id={`order-${key}`}
                          type={type}
                          required
                          placeholder={placeholder}
                          value={form[key]}
                          onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                          className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                        />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label htmlFor="order-notes" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                      Notas (opcional)
                    </label>
                    <textarea
                      id="order-notes"
                      rows={2}
                      placeholder="Dirección, observaciones…"
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 font-bold text-brand-navy"
                    />
                  </div>
                </div>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-brand-line px-7 py-5">
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-brand-line px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || pending}
                className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Creando…" : "Crear pedido"}
              </button>
            </footer>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
