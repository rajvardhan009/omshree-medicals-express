import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Cross } from "lucide-react";
import { api as supabase } from "@/lib/express-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, 
      { title: "Sign in – Omshree Medicals" },
      { name: "description", content: "Sign in or create an account for Omshree Medicals billing." },
      { property: "og:title", content: "Sign in – Omshree Medicals" },
      { property: "og:description", content: "Sign in to Omshree Medicals billing." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: f.email, password: f.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: f.full_name } },
        });
        if (error) throw error;
        if (data.session) nav({ to: "/dashboard" });
        else { toast.success("Check your email to confirm your account."); setMode("in"); }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 text-lg font-semibold"><Cross className="h-5 w-5 text-sidebar-primary" /> Omshree Medicals</div>
        <div>
          <p className="text-4xl font-semibold leading-tight">Bills, patients and payments —<br /><span className="text-sidebar-primary">in one counter.</span></p>
          <p className="mt-4 max-w-sm text-sidebar-foreground/70">OPD billing, indoor invoices, reports and AI bill reading. Works offline too.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© Omshree Medicals</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="mb-6 flex items-center gap-2 text-lg font-semibold md:hidden"><Cross className="h-5 w-5 text-primary" /> Omshree Medicals</div>
          <h1 className="text-2xl font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1>
          {mode === "up" && (
            <div className="space-y-1.5"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          )}
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Password</Label><Input type="password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
