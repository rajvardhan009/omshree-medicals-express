import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Export – Omshree Medicals" }, { name: "description", content: "Download bills and patients as CSV, JSON or Excel." }, { property: "og:title", content: "Export – Omshree Medicals" }, { property: "og:description", content: "Download bills and patients as CSV, JSON or Excel." }] }),
  component: ExportPage,
});

const TYPES = {
  bills: { label: "OPD bills", fetch: () => supabase.from("bills").select("sequential_number,date_based_number,patient_name,patient_address,manual_amount,amount,payment_mode,notes,created_at").order("created_at", { ascending: false }) },
  indoor_patients: { label: "Indoor patients", fetch: () => supabase.from("indoor_patients").select("indoor_id,patient_name,age,gender,contact_number,admission_date,discharge_date,doctor_department,room_bed_no,status").eq("is_deleted", false) },
  indoor_bills: { label: "Indoor invoices", fetch: () => supabase.from("indoor_bills").select("invoice_number,item_total,other_charges,final_amount,amount_paid,balance,payment_mode,payment_status,payment_date") },
} as const;
type T = keyof typeof TYPES;

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function ExportPage() {
  const [type, setType] = useState<T>("bills");
  const [busy, setBusy] = useState(false);

  async function go(format: "csv" | "json" | "xlsx") {
    setBusy(true);
    try {
      const { data, error } = await TYPES[type].fetch();
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      const name = `${type}-${new Date().toISOString().slice(0, 10)}`;
      if (format === "json") download(`${name}.json`, new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
      else if (format === "csv") {
        const cols = rows[0] ? Object.keys(rows[0]) : [];
        download(`${name}.csv`, new Blob([[cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n")], { type: "text/csv" }));
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), type.slice(0, 30));
        XLSX.writeFile(wb, `${name}.xlsx`);
      }
      toast.success(`Exported ${rows.length} rows.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Export" sub="Download your data" />
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(TYPES) as T[]).map((k) => (
          <Button key={k} variant={type === k ? "default" : "outline"} onClick={() => setType(k)}>{TYPES[k].label}</Button>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => go("csv")}><FileText className="h-4 w-4" /> CSV</Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => go("json")}><FileJson className="h-4 w-4" /> JSON</Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => go("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      </div>
    </div>
  );
}
