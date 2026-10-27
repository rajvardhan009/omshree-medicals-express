import { Router } from "express";
import { tx } from "../db/pool.js";
import { wrap } from "../middleware/auth.js";
import { createBill, updateBill } from "../lib.js";
const r = Router();
// Body: { changes: [{ client_id, op: "create"|"update"|"delete", entity: "bills", payload }] }
r.post("/sync", wrap(async (req, res) => {
  const results = [];
  for (const ch of req.body.changes || []) {
    try {
      const data = await tx(async (c) => {
        if (ch.entity !== "bills") throw new Error("Unsupported entity");
        if (ch.op === "create") {
          const { rows: [ex] } = await c.query("SELECT * FROM bills WHERE id=$1 AND user_id=$2", [ch.payload.id, req.user.id]);
          return ex || createBill(c, req.user.id, ch.payload);
        }
        if (ch.op === "update") return updateBill(c, req.user.id, ch.payload.id, ch.payload);
        if (ch.op === "delete") { await c.query("DELETE FROM bills WHERE id=$1 AND user_id=$2", [ch.payload.id, req.user.id]); return null; }
        throw new Error("Unknown op");
      });
      results.push({ client_id: ch.client_id, ok: true, data });
    } catch (e) { results.push({ client_id: ch.client_id, ok: false, error: e.message }); }
  }
  res.json({ results });
}));
export default r;
