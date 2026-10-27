import { Router } from "express";
import { q, tx } from "../db/pool.js";
import { wrap } from "../middleware/auth.js";
import { createBill, updateBill } from "../lib.js";
const r = Router();
r.get("/", wrap(async (req, res) => {
  const { search = "", from, to, until } = req.query;
  const p = [req.user.id]; let w = "user_id=$1";
  if (search) { p.push(`%${search}%`); w += ` AND (patient_name ILIKE $${p.length} OR date_based_number ILIKE $${p.length} OR sequential_number::text ILIKE $${p.length})`; }
  if (from) { p.push(from); w += ` AND created_at >= $${p.length}::timestamptz`; }
  if (to) { p.push(to); w += ` AND created_at < ($${p.length}::date + 1)`; }
  if (until) { p.push(until); w += ` AND created_at < $${p.length}::timestamptz`; }
  const limit = Math.max(1, Math.min(1000000, Number(req.query.limit) || 1000));
  p.push(limit);
  res.json((await q(`SELECT * FROM bills WHERE ${w} ORDER BY created_at DESC LIMIT $${p.length}`, p)).rows);
}));
r.post("/", wrap(async (req, res) => {
  if (!req.body.patient_name) return res.status(400).json({ error: "patient_name required" });
  res.status(201).json(await tx((c) => createBill(c, req.user.id, req.body)));
}));
r.get("/:id", wrap(async (req, res) => {
  const { rows: [b] } = await q("SELECT * FROM bills WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  b ? res.json(b) : res.status(404).json({ error: "Not found" });
}));
r.put("/:id", wrap(async (req, res) => {
  const b = await tx((c) => updateBill(c, req.user.id, req.params.id, req.body));
  b ? res.json(b) : res.status(404).json({ error: "Not found" });
}));
r.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await q("DELETE FROM bills WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  rowCount ? res.status(204).end() : res.status(404).json({ error: "Not found" });
}));
export default r;
