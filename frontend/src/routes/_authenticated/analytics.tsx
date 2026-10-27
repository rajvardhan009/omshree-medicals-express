import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api as supabase } from "@/lib/express-api";
import { PageHeader, Stat } from "@/components/PageHeader";
import { inr } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Analytics – Omshree Medicals" }, { name: "description", content: "Sales trends and payment breakdown." }, { property: "og:title", content: "Analytics – Omshree Medicals" }, { property: "og:description", content: "Sales trends and payment breakdown." }] }),
  component: Analytics,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function Analytics() {
  const { data } = useQuery({
    queryKey: ["bills", "analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 29 * 86400000); since.setHours(0, 0, 0, 0);
      const [bills, all, ib] = await Promise.all([
        supabase.from("bills").select("amount,payment_mode,created_at").gte("created_at", since.toISOString()),
        supabase.from("bills").select("amount"),
        supabase.from("indoor_bills").select("final_amount,balance"),
      ]);
      const days: Record<string, number> = {};
      for (let i = 0; i < 30; i++) { const d = new Date(since.getTime() + i * 86400000); days[d.toLocaleDateString("en-CA")] = 0; }
      const modes: Record<string, number> = {};
      for (const b of bills.data ?? []) {
        const k = new Date(b.created_at).toLocaleDateString("en-CA");
        days[k] = (days[k] ?? 0) + Number(b.amount);
        modes[b.payment_mode] = (modes[b.payment_mode] ?? 0) + Number(b.amount);
      }
      return {
        daily: Object.entries(days).map(([day, sum]) => ({ day: day.slice(5), sum })),
        modes: Object.entries(modes).map(([name, value]) => ({ name, value })),
        month: (bills.data ?? []).reduce((s, b) => s + Number(b.amount), 0),
        total: (all.data ?? []).reduce((s, b) => s + Number(b.amount), 0),
        count: all.data?.length ?? 0,
        indoorBilled: (ib.data ?? []).reduce((s, b) => s + Number(b.final_amount), 0),
        outstanding: (ib.data ?? []).reduce((s, b) => s + Number(b.balance), 0),
      };
    },
  });

  return (
    <div>
      <PageHeader title="Analytics" sub="Last 30 days" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Last 30 days" value={inr(data?.month)} />
        <Stat label="All-time OPD" value={inr(data?.total)} hint={`${data?.count ?? 0} bills`} />
        <Stat label="Indoor billed" value={inr(data?.indoorBilled)} />
        <Stat label="Outstanding" value={inr(data?.outstanding)} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <p className="mb-3 font-medium">Daily sales</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} interval={4} />
                <YAxis fontSize={11} tickLine={false} width={50} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="sum" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 font-medium">Payment modes</p>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.modes ?? []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label={(e) => e.name}>
                  {(data?.modes ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
