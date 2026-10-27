import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { BarChart3, BedDouble, Cross, Download, FileText, LayoutDashboard, Receipt, Settings, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { useSyncStatus } from "@/lib/offline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/indoor-billing", label: "Indoor", icon: BedDouble },
  { to: "/billing-records", label: "Records", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/export", label: "Export", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SyncBadge() {
  const s = useSyncStatus();
  const Icon = !s.online ? WifiOff : s.syncing ? RefreshCw : Wifi;
  const label = !s.online ? "Offline" : s.syncing ? "Syncing" : "Online";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      s.online ? "bg-accent text-accent-foreground" : "bg-warning/20 text-foreground")}>
      <Icon className={cn("h-3.5 w-3.5", s.syncing && "animate-spin")} /> {label}
      {s.pending > 0 && <span className="num">({s.pending} pending)</span>}
    </span>
  );
}

function Shell() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold"><Cross className="h-5 w-5 text-sidebar-primary" /> Omshree</div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 font-semibold md:hidden"><Cross className="h-5 w-5 text-primary" /> Omshree Medicals</div>
          <div className="hidden md:block" />
          <SyncBadge />
        </header>
        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10"><Outlet /></main>
        <nav className="no-print fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t bg-card md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
              activeProps={{ className: "!text-primary font-medium" }}>
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
