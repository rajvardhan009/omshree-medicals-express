import { Router } from "express";
import { q } from "../db/pool.js";
import { wrap } from "../middleware/auth.js";
const r = Router();
r.get("/", wrap(async (req, res) => res.json((await q("SELECT * FROM common_medicines WHERE user_id=$1 ORDER BY medicine_name", [req.user.id])).rows)));
r.post("/", wrap(async (req, res) => {
  const { medicine_name, default_qty = 1, unit = null, mrp_per_unit = 0 } = req.body;
  if (!medicine_name) return res.status(400).json({ error: "medicine_name required" });
  res.status(201).json((await q("INSERT INTO common_medicines (user_id,medicine_name,default_qty,unit,mrp_per_unit) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [req.user.id, medicine_name, default_qty, unit, mrp_per_unit])).rows[0]);
}));
r.put("/:id", wrap(async (req, res) => {
  const b = req.body;
  const { rows: [m] } = await q(`UPDATE common_medicines SET medicine_name=COALESCE($3,medicine_name),default_qty=COALESCE($4,default_qty),
    unit=COALESCE($5,unit),mrp_per_unit=COALESCE($6,mrp_per_unit),is_active=COALESCE($7,is_active) WHERE id=$1 AND user_id=$2 RETURNING *`,
    [req.params.id, req.user.id, b.medicine_name, b.default_qty, b.unit, b.mrp_per_unit, b.is_active]);
  m ? res.json(m) : res.status(404).json({ error: "Not found" });
}));
r.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await q("DELETE FROM common_medicines WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  rowCount ? res.status(204).end() : res.status(404).json({ error: "Not found" });
}));
export default r;
