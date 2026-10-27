export type Product = { name: string; quantity: number; mrp: number };

const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

/** Regular bill total = manual amount + sum(qty x MRP). */
export function billTotal(manual: unknown, products: Product[] = []) {
  return n(n(manual) + products.reduce((s, p) => s + n(p.quantity) * n(p.mrp), 0));
}

/** Indoor invoice math. */
export function indoorTotals(itemTotal: unknown, other: unknown, paid: unknown) {
  const final = n(n(itemTotal) + n(other));
  const balance = n(final - n(paid));
  const status = balance <= 0 ? "Paid" : n(paid) > 0 ? "Partial" : "Unpaid";
  return { final, balance, status } as const;
}

const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
export const inr = (v: unknown) => fmt.format(Number(v) || 0);
