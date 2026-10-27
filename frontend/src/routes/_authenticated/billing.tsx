import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api as supabase } from "@/lib/express-api";
import { PageHeader } from "@/components/PageHeader";
import { BillForm, emptyBill } from "@/components/BillForm";
import { Receipt, type ReceiptBill } from "@/components/Receipt";
import { Button } from "@/components/ui/button";
import { saveBillChange } from "@/lib/offline";
import { billTotal } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "New bill – Omshree Medicals" }, { name: "description", content: "Create an OPD bill." }, { property: "og:title", content: "New bill – Omshree Medicals" }, { property: "og:description", content: "Create an OPD bill." }] }),
  component: BillingPage,
});

function BillingPage() {
  const qc = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState(emptyBill);
  const [last, setLast] = useState<ReceiptBill | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Regular billing" sub="Type an amount, add products, or upload a bill photo." />
      {last ? (
        <div className="space-y-4">
          <Receipt bill={last} />
          <div className="no-print flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            <Button onClick={() => { setLast(null); setInitial(emptyBill()); setFormKey((k) => k + 1); }}>New bill</Button>
          </div>
        </div>
      ) : (
        <BillForm key={formKey} initial={initial} onSave={async (b) => {
          const r = await saveBillChange("create", b);
          let saved: ReceiptBill = { ...b, amount: billTotal(b.manual_amount, b.products) };
          if (r.queued) toast.info("Saved offline. It will sync when you're back online.");
          else {
            const { data } = await supabase.from("bills").select("*").eq("id", b.id).single();
            if (data) saved = data as unknown as ReceiptBill;
            toast.success("Bill saved.");
          }
          qc.invalidateQueries({ queryKey: ["bills"] });
          setLast(saved);
        }} />
      )}
    </div>
  );
}
