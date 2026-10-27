import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LogOut, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr, indoorTotals } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/indoor-billing")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Indoor billing – Omshree Medicals" }, { name: "description", content: "Admitted patients, medicines, invoices and payments." }, { property: "og:title", content: "Indoor billing – Omshree Medicals" }, { property: "og:description", content: "Admitted patients, medicines, invoices and payments." }] }),
  component: IndoorPage,
});

const PAY = ["Cash", "Card", "UPI", "Hospital Account"] as const;
const blankPatient = { patient_name: "", age: "", gender: "", address: "", contact_number: "", doctor_department: "", room_bed_no: "", admission_date: new Date().toISOString().slice(0, 10) };

function IndoorPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [p, setP] = useState(blankPatient);

  const { data: patients = [] } = useQuery({
    queryKey: ["indoor"],
    queryFn: async () => {
      const { data, error } = await supabase.from("indoor_patients").select("*, indoor_bills(final_amount,balance,payment_status,invoice_number)").eq("is_deleted", false).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function admit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.patient_name.trim()) { toast.error("Patient name is required."); return; }
    const { error } = await supabase.from("indoor_patients").insert({ ...p, age: p.age ? Number(p.age) : null } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient admitted.");
    setAdmitOpen(false); setP(blankPatient);
    qc.invalidateQueries({ queryKey: ["indoor"] });
  }

  if (selected) return <PatientDetail id={selected} onBack={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["indoor"] }); }} />;

  return (
    <div>
      <PageHeader title="Indoor billing" sub="Admitted patients and their invoices">
        <Button onClick={() => setAdmitOpen(true)}><UserPlus className="h-4 w-4" /> Admit patient</Button>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {patients.length === 0 && <p className="text-sm text-muted-foreground">No patients yet.</p>}
        {patients.map((x) => {
          const bill = Array.isArray(x.indoor_bills) ? x.indoor_bills[0] : x.indoor_bills;
          return (
            <button key={x.id} onClick={() => setSelected(x.id)} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{x.patient_name}</p><p className="num text-xs text-muted-foreground">{x.indoor_id} · Bed {x.room_bed_no || "—"}</p></div>
                <Badge variant={x.status === "Admitted" ? "default" : "secondary"}>{x.status}</Badge>
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">{x.doctor_department || "—"}</span>
                {bill ? <span className="num">{inr(bill.balance)} due</span> : <span className="text-muted-foreground">No invoice</span>}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={admitOpen} onOpenChange={setAdmitOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Admit patient</DialogTitle></DialogHeader>
          <form onSubmit={admit} className="grid grid-cols-2 gap-3">
            {([["patient_name", "Name *", 2], ["age", "Age", 1], ["gender", "Gender", 1], ["contact_number", "Contact", 1], ["admission_date", "Admission date", 1], ["doctor_department", "Doctor / dept", 1], ["room_bed_no", "Room / bed", 1], ["address", "Address", 2]] as const).map(([k, label, span]) => (
              <div key={k} className={span === 2 ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label>{label}</Label>
                <Input type={k === "admission_date" ? "date" : k === "age" ? "number" : "text"} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </div>
            ))}
            <Button className="col-span-2">Admit</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const key = ["indoor", id];
  const [med, setMed] = useState({ medicine_name: "", unit: "", quantity: 1, mrp_per_unit: 0 });
  const [pay, setPay] = useState<{ other: string; paid: string; mode: string }>({ other: "", paid: "", mode: "" });

  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [pt, meds, bill, common] = await Promise.all([
        supabase.from("indoor_patients").select("*").eq("id", id).single(),
        supabase.from("indoor_medicines").select("*").eq("indoor_patient_id", id).order("created_at"),
        supabase.from("indoor_bills").select("*").eq("indoor_patient_id", id).maybeSingle(),
        supabase.from("common_medicines").select("*").eq("is_active", true).order("medicine_name"),
      ]);
      return { patient: pt.data, meds: meds.data ?? [], bill: bill.data, common: common.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  if (!data?.patient) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { patient, meds, bill, common } = data;
  const itemTotal = meds.reduce((s, m) => s + Number(m.subtotal), 0);
  const other = pay.other !== "" ? Number(pay.other) : Number(bill?.other_charges ?? 0);
  const paid = pay.paid !== "" ? Number(pay.paid) : Number(bill?.amount_paid ?? 0);
  const t = indoorTotals(itemTotal, other, paid);
  const mode = pay.mode || bill?.payment_mode || "";

  async function addMed(m: typeof med) {
    if (!m.medicine_name.trim()) { toast.error("Medicine name is required."); return; }
    const { error } = await supabase.from("indoor_medicines").insert({ ...m, indoor_patient_id: id } as never);
    if (error) { toast.error(error.message); return; }
    setMed({ medicine_name: "", unit: "", quantity: 1, mrp_per_unit: 0 });
    refresh();
  }
  async function saveCommon() {
    if (!med.medicine_name.trim()) return;
    const { error } = await supabase.from("common_medicines").insert({ medicine_name: med.medicine_name, unit: med.unit, default_qty: med.quantity, mrp_per_unit: med.mrp_per_unit } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Added to common list."); refresh();
  }
  async function saveInvoice(finalize = false) {
    const row = { indoor_patient_id: id, other_charges: other, amount_paid: paid, payment_mode: mode || null, payment_date: paid > 0 ? new Date().toISOString().slice(0, 10) : null, is_finalized: finalize || !!bill?.is_finalized };
    const { error } = bill ? await supabase.from("indoor_bills").update(row as never).eq("id", bill.id) : await supabase.from("indoor_bills").insert(row as never);
    if (error) { toast.error(error.message); return; }
    toast.success(bill ? "Invoice updated." : "Invoice created.");
    setPay({ other: "", paid: "", mode: "" }); refresh();
  }
  async function discharge() {
    const { error } = await supabase.from("indoor_patients").update({ status: "Discharged", discharge_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient discharged."); refresh();
  }
  async function remove() {
    if (!confirm("Remove this patient?")) return;
    await supabase.from("indoor_patients").update({ is_deleted: true }).eq("id", id);
    toast.success("Patient removed."); onBack();
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> All patients</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {patient.status === "Admitted" && <Button variant="outline" onClick={discharge}><LogOut className="h-4 w-4" /> Discharge</Button>}
          <Button variant="ghost" size="icon" aria-label="Remove patient" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="print-only text-lg font-semibold">Omshree Medicals – Indoor invoice {bill?.invoice_number}</p>
            <h1 className="text-2xl font-semibold">{patient.patient_name}</h1>
            <p className="num text-sm text-muted-foreground">{patient.indoor_id} · {patient.age ? `${patient.age} yrs` : ""} {patient.gender} · Bed {patient.room_bed_no || "—"}</p>
            <p className="text-sm text-muted-foreground">{patient.doctor_department} · Admitted {patient.admission_date}{patient.discharge_date ? ` · Discharged ${patient.discharge_date}` : ""}</p>
          </div>
          <Badge variant={patient.status === "Admitted" ? "default" : "secondary"}>{patient.status}</Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <p className="border-b px-4 py-2.5 text-sm font-medium">Medicines</p>
        {meds.map((m) => (
          <div key={m.id} className="flex items-center gap-2 border-b px-4 py-2 text-sm">
            <span className="flex-1">{m.medicine_name} {m.unit && <span className="text-muted-foreground">({m.unit})</span>}</span>
            <span className="num text-muted-foreground">{Number(m.quantity)} × {inr(m.mrp_per_unit)}</span>
            <span className="num w-24 text-right font-medium">{inr(m.subtotal)}</span>
            <Button className="no-print" size="icon" variant="ghost" aria-label="Remove medicine" onClick={async () => { await supabase.from("indoor_medicines").delete().eq("id", m.id); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="no-print space-y-2 p-3">
          {common.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {common.map((c) => (
                <Button key={c.id} size="sm" variant="secondary" onClick={() => addMed({ medicine_name: c.medicine_name, unit: c.unit ?? "", quantity: Number(c.default_qty), mrp_per_unit: Number(c.mrp_per_unit) })}>
                  <Plus className="h-3 w-3" /> {c.medicine_name}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_70px_64px_84px] gap-2">
            <Input placeholder="Medicine" value={med.medicine_name} onChange={(e) => setMed({ ...med, medicine_name: e.target.value })} />
            <Input placeholder="Unit" value={med.unit} onChange={(e) => setMed({ ...med, unit: e.target.value })} />
            <Input className="num" type="number" min={0} step="any" value={med.quantity} onChange={(e) => setMed({ ...med, quantity: Number(e.target.value) })} aria-label="Quantity" />
            <Input className="num" type="number" min={0} step="0.01" value={med.mrp_per_unit} onChange={(e) => setMed({ ...med, mrp_per_unit: Number(e.target.value) })} aria-label="MRP per unit" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMed(med)}><Plus className="h-4 w-4" /> Add medicine</Button>
            <Button size="sm" variant="ghost" onClick={saveCommon}>Save to common list</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Invoice {bill?.invoice_number && <span className="num text-muted-foreground">{bill.invoice_number}</span>}</p>
          <Badge variant={t.status === "Paid" ? "default" : "secondary"}>{t.status}</Badge>
        </div>
        <div className="no-print grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Other charges (₹)</Label><Input className="num" type="number" min={0} value={pay.other !== "" ? pay.other : String(bill?.other_charges ?? 0)} onChange={(e) => setPay({ ...pay, other: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Amount paid (₹)</Label><Input className="num" type="number" min={0} value={pay.paid !== "" ? pay.paid : String(bill?.amount_paid ?? 0)} onChange={(e) => setPay({ ...pay, paid: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Payment mode</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
              <option value="">—</option>{PAY.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <dl className="num mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Medicines</dt><dd>{inr(itemTotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Other charges</dt><dd>{inr(other)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Final amount</dt><dd>{inr(t.final)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd>{inr(paid)}</dd></div>
          <div className="flex justify-between font-semibold text-primary"><dt>Balance</dt><dd>{inr(t.balance)}</dd></div>
        </dl>
        <div className="no-print mt-4 flex gap-2">
          <Button onClick={() => saveInvoice(false)}>{bill ? "Save payment" : "Create invoice"}</Button>
          {bill && !bill.is_finalized && <Button variant="outline" onClick={() => saveInvoice(true)}>Finalize</Button>}
        </div>
      </div>
    </div>
  );
}
