import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncOutbox, useSyncStatus } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Settings – Omshree Medicals" }, { name: "description", content: "Account, offline storage and sign out." }, { property: "og:title", content: "Settings – Omshree Medicals" }, { property: "og:description", content: "Account, offline storage and sign out." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const sync = useSyncStatus();
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
  }, [user.id]);

  async function save() {
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: name, email: user.email ?? null });
    error ? toast.error(error.message) : toast.success("Saved.");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Settings" />
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={save}>Save</Button>
      </section>
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="font-medium">Offline storage</h2>
        <p className="text-sm text-muted-foreground">Status: {sync.online ? "Online" : "Offline"} · {sync.pending} change(s) waiting to sync. Bills saved offline sync automatically when you reconnect.</p>
        <Button variant="outline" onClick={() => syncOutbox()}>Sync now</Button>
      </section>
      <Button variant="destructive" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}><LogOut className="h-4 w-4" /> Sign out</Button>
    </div>
  );
}
