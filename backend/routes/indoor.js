import { Router } from "express";
import { q, tx } from "../db/pool.js";
import { wrap } from "../middleware/auth.js";
import { num, paymentStatus, lockUser } from "../lib.js";
const r = Router();
const own = async (id, uid) => (await q("SELECT * FROM indoor_patients WHERE id=$1 AND user_id=$2 AND NOT is_deleted", [id, uid])).rows[0];
const F = ["patient_name","age","gender","address","contact_number","admission_date","discharge_date","doctor_department","room_bed_no"];
r.get("/indoor-patients", wrap(async (req, res) => {
  res.json((await q(`SELECT p.*, CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('final_amount',b.final_amount,'balance',b.balance,'payment_status',b.payment_status,'invoice_number',b.invoice_number) END AS indoor_bills FROM indoor_patients p
    LEFT JOIN indoor_bills b ON b.indoor_patient_id=p.id WHERE p.user_id=$1 AND NOT p.is_deleted ORDER BY p.created_at DESC`, [req.user.id])).rows);
}));
r.get("/indoor-patients/:id", wrap(async (req, res) => {
  const p = await own(req.params.id, req.user.id);
  p ? res.json(p) : res.status(404).json({ error: "Not found" });
}));
r.get("/indoor-bills", wrap(async (req, res) => {
  res.json((await q("SELECT * FROM indoor_bills WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id])).rows);
}));
r.get("/indoor-bills/:id", wrap(async (req, res) => {
  const { rows: [b] } = await q("SELECT * FROM indoor_bills WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  b ? res.json(b) : res.status(404).json({ error: "Not found" });
}));
r.post("/indoor-patients", wrap(async (req, res) => {
  if (!req.body.patient_name) return res.status(400).json({ error: "patient_name required" });
  const p = await tx(async (c) => {
    await lockUser(c, req.user.id, "ind");
    const y = new Date().getFullYear();
    const { rows: [n] } = await c.query("SELECT COUNT(*)+1 n FROM indoor_patients WHERE user_id=$1 AND indoor_id LIKE $2", [req.user.id, `IND-${y}-%`]);
    const v = F.map((f) => req.body[f] ?? null);
    v[5] = v[5] || new Date().toISOString().slice(0, 10);
    return (await c.query(`INSERT INTO indoor_patients (user_id,indoor_id,${F.join(",")}) VALUES ($1,$2,${F.map((_, i) => "$" + (i + 3)).join(",")}) RETURNING *`,
      [req.user.id, `IND-${y}-${String(n.n).padStart(4, "0")}`, ...v])).rows[0];
  });
  res.status(201).json(p);
}));
r.put("/indoor-patients/:id", wrap(async (req, res) => {
  const p = await own(req.params.id, req.user.id); if (!p) return res.status(404).json({ error: "Not found" });
  const v = F.map((f) => (f in req.body ? req.body[f] : p[f]));
  res.json((await q(`UPDATE indoor_patients SET ${F.map((f, i) => `${f}=$${i + 2}`).join(",")},updated_at=now() WHERE id=$1 RETURNING *`, [p.id, ...v])).rows[0]);
}));
r.delete("/indoor-patients/:id", wrap(async (req, res) => {
  const { rowCount } = await q("UPDATE indoor_patients SET is_deleted=true,updated_at=now() WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  rowCount ? res.status(204).end() : res.status(404).json({ error: "Not found" });
}));
r.post("/indoor-patients/:id/discharge", wrap(async (req, res) => {
  const { rows: [p] } = await q(`UPDATE indoor_patients SET status='Discharged',discharge_date=COALESCE($3,current_date),updated_at=now()
    WHERE id=$1 AND user_id=$2 AND NOT is_deleted RETURNING *`, [req.params.id, req.user.id, req.body.discharge_date || null]);
  p ? res.json(p) : res.status(404).json({ error: "Not found" });
}));
async function recalc(c, pid, uid) {
  const { rows: [t] } = await c.query("SELECT COALESCE(SUM(subtotal),0) s FROM indoor_medicines WHERE indoor_patient_id=$1 AND user_id=$2", [pid, uid]);
  await c.query(`UPDATE indoor_bills SET item_total=$3, final_amount=$3+other_charges, balance=$3+other_charges-amount_paid,
    payment_status=CASE WHEN $3+other_charges-amount_paid<=0 THEN 'Paid' WHEN amount_paid>0 THEN 'Partial' ELSE 'Unpaid' END, updated_at=now()
    WHERE indoor_patient_id=$1 AND user_id=$2 AND NOT is_finalized`, [pid, uid, t.s]);
}
r.get("/indoor-patients/:id/medicines", wrap(async (req, res) => {
  res.json((await q("SELECT * FROM indoor_medicines WHERE indoor_patient_id=$1 AND user_id=$2 ORDER BY created_at", [req.params.id, req.user.id])).rows);
}));
r.post("/indoor-patients/:id/medicines", wrap(async (req, res) => {
  if (!(await own(req.params.id, req.user.id))) return res.status(404).json({ error: "Not found" });
  const list = Array.isArray(req.body) ? req.body : [req.body];
  const out = await tx(async (c) => {
    const rows = [];
    for (const m of list) rows.push((await c.query(`INSERT INTO indoor_medicines (user_id,indoor_patient_id,medicine_name,unit,quantity,mrp_per_unit)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.user.id, req.params.id, m.medicine_name, m.unit || null, num(m.quantity) || 1, num(m.mrp_per_unit)])).rows[0]);
    await recalc(c, req.params.id, req.user.id); return rows;
  });
  res.status(201).json(Array.isArray(req.body) ? out : out[0]);
}));
r.put("/medicines/:id", wrap(async (req, res) => {
  const m = await tx(async (c) => {
    const { rows: [m] } = await c.query(`UPDATE indoor_medicines SET medicine_name=COALESCE($3,medicine_name),unit=COALESCE($4,unit),
      quantity=COALESCE($5,quantity),mrp_per_unit=COALESCE($6,mrp_per_unit) WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user.id, req.body.medicine_name, req.body.unit, req.body.quantity, req.body.mrp_per_unit]);
    if (m) await recalc(c, m.indoor_patient_id, req.user.id); return m;
  });
  m ? res.json(m) : res.status(404).json({ error: "Not found" });
}));
r.delete("/medicines/:id", wrap(async (req, res) => {
  const ok = await tx(async (c) => {
    const { rows: [m] } = await c.query("DELETE FROM indoor_medicines WHERE id=$1 AND user_id=$2 RETURNING indoor_patient_id", [req.params.id, req.user.id]);
    if (m) await recalc(c, m.indoor_patient_id, req.user.id); return !!m;
  });
  ok ? res.status(204).end() : res.status(404).json({ error: "Not found" });
}));
r.get("/indoor-patients/:id/bill", wrap(async (req, res) => {
  const { rows: [b] } = await q("SELECT * FROM indoor_bills WHERE indoor_patient_id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  res.json(b || null);
}));
r.post("/indoor-patients/:id/bill", wrap(async (req, res) => {
  if (!(await own(req.params.id, req.user.id))) return res.status(404).json({ error: "Not found" });
  const b = await tx(async (c) => {
    const uid = req.user.id, pid = req.params.id;
    const { rows: [t] } = await c.query("SELECT COALESCE(SUM(subtotal),0) s FROM indoor_medicines WHERE indoor_patient_id=$1", [pid]);
    const { rows: [ex] } = await c.query("SELECT * FROM indoor_bills WHERE indoor_patient_id=$1 AND user_id=$2", [pid, uid]);
    const other = num(req.body.other_charges ?? ex?.other_charges), paid = num(req.body.amount_paid ?? ex?.amount_paid);
    const item = num(t.s), fin = num(item + other), bal = num(fin - paid);
    const vals = [item, other, fin, paid, bal, req.body.payment_mode ?? ex?.payment_mode ?? null, paymentStatus(bal, paid),
      paid > 0 ? (req.body.payment_date || new Date().toISOString().slice(0, 10)) : null, req.body.notes ?? ex?.notes ?? null, !!req.body.is_finalized];
    if (ex) return (await c.query(`UPDATE indoor_bills SET item_total=$2,other_charges=$3,final_amount=$4,amount_paid=$5,balance=$6,payment_mode=$7,
      payment_status=$8,payment_date=$9,notes=$10,is_finalized=$11,updated_at=now() WHERE id=$1 RETURNING *`, [ex.id, ...vals])).rows[0];
    await lockUser(c, uid, "inv");
    const y = new Date().getFullYear();
    const { rows: [n] } = await c.query("SELECT COUNT(*)+1 n FROM indoor_bills WHERE user_id=$1 AND invoice_number LIKE $2", [uid, `INV-${y}-%`]);
    return (await c.query(`INSERT INTO indoor_bills (user_id,indoor_patient_id,invoice_number,item_total,other_charges,final_amount,amount_paid,balance,
      payment_mode,payment_status,payment_date,notes,is_finalized) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [uid, pid, `INV-${y}-${String(n.n).padStart(4, "0")}`, ...vals])).rows[0];
  });
  res.status(201).json(b);
}));
r.put("/indoor-bills/:id", wrap(async (req, res) => {
  const { rows: [ex] } = await q("SELECT * FROM indoor_bills WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  if (!ex) return res.status(404).json({ error: "Not found" });
  const paid = num(req.body.amount_paid ?? ex.amount_paid), other = num(req.body.other_charges ?? ex.other_charges);
  const fin = num(num(ex.item_total) + other), bal = num(fin - paid);
  res.json((await q(`UPDATE indoor_bills SET other_charges=$2,final_amount=$3,amount_paid=$4,balance=$5,payment_status=$6,
    payment_mode=COALESCE($7,payment_mode),payment_date=COALESCE($8,payment_date,current_date),notes=COALESCE($9,notes),is_finalized=COALESCE($10,is_finalized),updated_at=now() WHERE id=$1 RETURNING *`,
    [ex.id, other, fin, paid, bal, paymentStatus(bal, paid), req.body.payment_mode, req.body.payment_date, req.body.notes, req.body.is_finalized])).rows[0]);
}));
export default r;
