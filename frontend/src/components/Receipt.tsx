import { inr, type Product } from "@/lib/billing";

export type ReceiptBill = {
  sequential_number?: number | null; date_based_number?: string | null; patient_name: string; patient_address?: string | null;
  products: Product[]; manual_amount: number; amount: number; payment_mode: string; notes?: string | null; created_at?: string;
};

export function Receipt({ bill }: { bill: ReceiptBill }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-sm">
      <div className="mb-4 text-center">
        <p className="text-lg font-semibold">Omshree Medicals</p>
        <p className="text-xs text-muted-foreground">Bill receipt</p>
      </div>
      <div className="mb-3 flex justify-between text-xs text-muted-foreground">
        <span className="num">#{bill.sequential_number ?? "—"} · {bill.date_based_number ?? "pending sync"}</span>
        <span>{new Date(bill.created_at ?? Date.now()).toLocaleString("en-IN")}</span>
      </div>
      <p className="font-medium">{bill.patient_name}</p>
      {bill.patient_address && <p className="text-muted-foreground">{bill.patient_address}</p>}
      <table className="mt-3 w-full">
        <tbody>
          {bill.products.map((p, i) => (
            <tr key={i} className="border-b"><td className="py-1">{p.name}</td><td className="num py-1 text-right">{p.quantity} × {inr(p.mrp)}</td><td className="num py-1 text-right">{inr(p.quantity * p.mrp)}</td></tr>
          ))}
          {Number(bill.manual_amount) > 0 && <tr className="border-b"><td className="py-1" colSpan={2}>Amount</td><td className="num py-1 text-right">{inr(bill.manual_amount)}</td></tr>}
        </tbody>
      </table>
      <div className="mt-3 flex justify-between text-base font-semibold"><span>Total ({bill.payment_mode})</span><span className="num">{inr(bill.amount)}</span></div>
      {bill.notes && <p className="mt-2 text-xs text-muted-foreground">{bill.notes}</p>}
    </div>
  );
}
