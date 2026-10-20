export type Step = "cart" | "form" | "done";

export interface ConfirmedOrder {
  reference: string;
  totalCents: number;
}
