import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { PageHeader } from "@/components/PageHeader";
import { BillForm } from "@/components/BillForm";
import { Receipt, type ReceiptBill } from "@/components/Receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr } from "@/lib/billing";
import { pendingBills, saveBillChange, type BillInput } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/billing-records")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Billing records – Omshree Medicals" }, { name: "description", content: "Search, view, edit and delete bills." }, { property: "og:title", content: "Billing records – Omshree Medicals" }, { property: "og:description", content: "Search, view, edit and delete bills." }] }),
  component: RecordsPage,
});

type Row = ReceiptBill & { id: string; pending?: boolean };

function RecordsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<Row | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["bills", search, from, to],
    queryFn: async () => {
      let q = supabase.from("bills").select("*").order("created_at", { ascending: false }).limit(500);
      if (search) q = q.or(`patient_name.ilike.%${search}%,date_based_number.ilike.%${search}%`);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lt("created_at", new Date(new Date(to).getTime() + 86400000).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const pending: Row[] = pendingBills().map((b) => ({ ...b, amount: b.manual_amount + b.products.reduce((s, p) => s + p.quantity * p.mrp, 0), pending: true }));
  const rows = [...pending.filter((p) => !data.some((d) => d.id === p.id)), ...data];

  async function del(r: Row) {
    if (!confirm(`Delete bill for ${r.patient_name}?`)) return;
    await saveBillChange("delete", { id: r.id });
    toast.success("Bill deleted.");
    qc.invalidateQueries({ queryKey: ["bills"] });
  }

  return (
    <div>
      <PageHeader title="Billing records" sub={`${rows.length} bills`} />
      <div className="no-print mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Search patient or bill no." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No bills found.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.patient_name} {r.pending && <Badge variant="secondary">Pending sync</Badge>}</p>
              <p className="num text-xs text-muted-foreground">#{r.sequential_number ?? "—"} · {r.date_based_number ?? "—"} · {r.payment_mode} · {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "today"}</p>
            </div>
            <p className="num font-semibold">{inr(r.amount)}</p>
            <div className="flex">
              <Button size="icon" variant="ghost" aria-label="View" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
              {!r.pending && <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>}
              {!r.pending && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader className="no-print"><DialogTitle>Bill</DialogTitle></DialogHeader>
          {view && <Receipt bill={view} />}
          <Button className="no-print" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit bill</DialogTitle></DialogHeader>
          {edit && (
            <BillForm submitLabel="Update bill" initial={{
              id: edit.id, patient_name: edit.patient_name, patient_address: edit.patient_address ?? "", products: edit.products ?? [],
              manual_amount: Number(edit.manual_amount), payment_mode: edit.payment_mode as BillInput["payment_mode"], notes: edit.notes ?? "",
            }} onSave={async (b) => {
              await saveBillChange("update", b);
              toast.success("Bill updated.");
              setEdit(null);
              qc.invalidateQueries({ queryKey: ["bills"] });
            }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
