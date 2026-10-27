import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Plus } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { PageHeader, Stat } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Dashboard – Omshree Medicals" }, { name: "description", content: "Today's billing totals and recent bills." }, { property: "og:title", content: "Dashboard – Omshree Medicals" }, { property: "og:description", content: "Today's billing totals and recent bills." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["bills", "dashboard"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const [today, recent, admitted] = await Promise.all([
        supabase.from("bills").select("amount").gte("created_at", start.toISOString()),
        supabase.from("bills").select("id,patient_name,amount,date_based_number,payment_mode,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("indoor_patients").select("id", { count: "exact", head: true }).eq("status", "Admitted").eq("is_deleted", false),
      ]);
      return {
        todaySum: (today.data ?? []).reduce((s, b) => s + Number(b.amount), 0),
        todayCount: today.data?.length ?? 0,
        recent: recent.data ?? [],
        admitted: admitted.count ?? 0,
      };
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}>
        <Button asChild><Link to="/billing"><Plus className="h-4 w-4" /> New bill</Link></Button>
        <Button asChild variant="outline"><Link to="/indoor-billing"><BedDouble className="h-4 w-4" /> Indoor</Link></Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Today's sales" value={inr(data?.todaySum ?? 0)} />
        <Stat label="Bills today" value={String(data?.todayCount ?? 0)} />
        <Stat label="Admitted now" value={String(data?.admitted ?? 0)} />
      </div>
      <h2 className="mb-2 mt-8 font-semibold">Recent bills</h2>
      <div className="rounded-xl border bg-card">
        {(data?.recent ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No bills yet. Create your first one.</p>}
        {data?.recent.map((b) => (
          <div key={b.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
            <div><p className="font-medium">{b.patient_name}</p><p className="num text-xs text-muted-foreground">{b.date_based_number} · {b.payment_mode}</p></div>
            <p className="num font-semibold">{inr(b.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
