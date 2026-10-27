import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { billTotal, inr, type Product } from "@/lib/billing";
import type { BillInput } from "@/lib/offline";
import { analyzeBill } from "@/lib/express-api";

const MODES = ["Cash", "Card", "UPI"] as const;

export function emptyBill(): BillInput {
  return { id: crypto.randomUUID(), patient_name: "", patient_address: "", products: [], manual_amount: 0, payment_mode: "Cash", notes: "" };
}

export function BillForm({ initial, onSave, submitLabel = "Save bill" }: {
  initial: BillInput; onSave: (b: BillInput) => Promise<void>; submitLabel?: string;
}) {
  const [b, setB] = useState<BillInput>(initial);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = analyzeBill;
  const total = billTotal(b.manual_amount, b.products);

  const setP = (i: number, patch: Partial<Product>) =>
    setB({ ...b, products: b.products.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  async function onFile(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Please choose a JPG or PNG photo."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10 MB."); return; }
    setReading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const out = await analyze({ data: { mime: file.type as "image/jpeg", base64 } });
      if (!out.ok) { toast.error(out.error); return; }
      const x = out.bill;
      const productSum = billTotal(0, x.products);
      setB((cur) => ({
        ...cur,
        patient_name: x.patient_name || cur.patient_name,
        patient_address: x.patient_address || cur.patient_address,
        products: x.products.length ? x.products : cur.products,
        manual_amount: x.products.length ? 0 : x.total || cur.manual_amount,
        notes: x.notes || cur.notes,
      }));
      toast.success(`Bill read. Check the details${x.total && Math.abs(x.total - productSum) > 1 && x.products.length ? ` (bill total ${inr(x.total)})` : ""}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setReading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!b.patient_name.trim()) { toast.error("Patient name is required."); return; }
    setBusy(true);
    try {
      await onSave({ ...b, products: b.products.filter((p) => p.name.trim()), manual_amount: Number(b.manual_amount) || 0 });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex justify-end">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Button type="button" variant="outline" disabled={reading} onClick={() => fileRef.current?.click()}>
          <Camera className="h-4 w-4" /> {reading ? "Reading bill…" : "Upload bill photo"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Patient name *</Label><Input value={b.patient_name} onChange={(e) => setB({ ...b, patient_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Address</Label><Input value={b.patient_address ?? ""} onChange={(e) => setB({ ...b, patient_address: e.target.value })} /></div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">Products (optional)</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setB({ ...b, products: [...b.products, { name: "", quantity: 1, mrp: 0 }] })}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </div>
        {b.products.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">No products. Use the amount below for a quick bill.</p>}
        {b.products.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_88px_auto] items-center gap-2 border-b px-3 py-2 last:border-0">
            <Input placeholder="Name" value={p.name} onChange={(e) => setP(i, { name: e.target.value })} />
            <Input className="num" type="number" min={0} step="any" placeholder="Qty" value={p.quantity} onChange={(e) => setP(i, { quantity: Number(e.target.value) })} />
            <Input className="num" type="number" min={0} step="0.01" placeholder="MRP" value={p.mrp} onChange={(e) => setP(i, { mrp: Number(e.target.value) })} />
            <Button type="button" size="icon" variant="ghost" aria-label="Remove row" onClick={() => setB({ ...b, products: b.products.filter((_, j) => j !== i) })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Manual amount (₹)</Label>
          <Input className="num" type="number" min={0} step="0.01" value={b.manual_amount} onChange={(e) => setB({ ...b, manual_amount: Number(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Payment mode</Label>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <Button key={m} type="button" variant={b.payment_mode === m ? "default" : "outline"} className="flex-1" onClick={() => setB({ ...b, payment_mode: m })}>{m}</Button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={b.notes ?? ""} onChange={(e) => setB({ ...b, notes: e.target.value })} /></div>

      <div className="flex items-center justify-between rounded-xl bg-sidebar px-5 py-4 text-sidebar-foreground">
        <div><p className="text-xs uppercase tracking-wide opacity-70">Total</p><p className="num text-3xl font-semibold">{inr(total)}</p></div>
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
