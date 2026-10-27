import { useEffect, useState } from "react";
import { api as supabase } from "@/lib/express-api";
import type { Product } from "./billing";

export type BillInput = {
  id: string;
  patient_name: string;
  patient_address: string | null;
  products: Product[];
  manual_amount: number;
  payment_mode: "Cash" | "Card" | "UPI";
  notes: string | null;
};
type OutboxItem = { op: "create" | "update" | "delete"; payload: BillInput | { id: string }; at: number };

const KEY = "omshree-express-outbox";
const listeners = new Set<() => void>();
let syncing = false;

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}
export const pendingBills = () => read().filter((i) => i.op === "create").map((i) => i.payload as BillInput);

async function run(item: OutboxItem) {
  if (item.op === "delete") return supabase.from("bills").delete().eq("id", item.payload.id);
  const p = item.payload as BillInput;
  if (item.op === "create") return supabase.from("bills").upsert(p as never, { onConflict: "id", ignoreDuplicates: true });
  const { id, ...rest } = p;
  return supabase.from("bills").update(rest as never).eq("id", id);
}

/** Save a bill change: try the server first, queue it locally when offline. */
export async function saveBillChange(op: OutboxItem["op"], payload: OutboxItem["payload"]) {
  const item = { op, payload, at: Date.now() };
  if (navigator.onLine) {
    const { error } = await run(item);
    if (!error) return { queued: false };
    if (!/fetch|network/i.test(error.message)) throw new Error(error.message);
  }
  write([...read(), item]);
  return { queued: true };
}

export async function syncOutbox() {
  if (syncing || !navigator.onLine) return;
  const items = read();
  if (!items.length) return;
  syncing = true; listeners.forEach((l) => l());
  const left: OutboxItem[] = [];
  for (const it of items) {
    const { error } = await run(it);
    if (error) left.push(it);
  }
  syncing = false;
  write(left);
}

export function useSyncStatus() {
  const [s, set] = useState({ online: true, pending: 0, syncing: false });
  useEffect(() => {
    const update = () => set({ online: navigator.onLine, pending: read().length, syncing });
    listeners.add(update);
    update();
    const on = () => { update(); void syncOutbox(); };
    window.addEventListener("online", on);
    window.addEventListener("offline", update);
    const t = setInterval(() => void syncOutbox(), 30000);
    void syncOutbox();
    return () => { listeners.delete(update); window.removeEventListener("online", on); window.removeEventListener("offline", update); clearInterval(t); };
  }, []);
  return s;
}
