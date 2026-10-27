import { Router } from "express";
import ExcelJS from "exceljs";
import { q } from "../db/pool.js";
import { wrap } from "../middleware/auth.js";
const r = Router();
r.get("/analytics/summary", wrap(async (req, res) => {
  const u = req.user.id;
  const [today, month, total, daily, modes, indoor] = await Promise.all([
    q("SELECT COUNT(*)::int count, COALESCE(SUM(amount),0)::float sum FROM bills WHERE user_id=$1 AND created_at::date=current_date", [u]),
    q("SELECT COUNT(*)::int count, COALESCE(SUM(amount),0)::float sum FROM bills WHERE user_id=$1 AND date_trunc('month',created_at)=date_trunc('month',now())", [u]),
    q("SELECT COUNT(*)::int count, COALESCE(SUM(amount),0)::float sum FROM bills WHERE user_id=$1", [u]),
    q(`SELECT to_char(d,'YYYY-MM-DD') day, COALESCE(SUM(b.amount),0)::float sum FROM generate_series(current_date-29,current_date,'1 day') d
       LEFT JOIN bills b ON b.user_id=$1 AND b.created_at::date=d GROUP BY d ORDER BY d`, [u]),
    q("SELECT payment_mode, COUNT(*)::int count, SUM(amount)::float sum FROM bills WHERE user_id=$1 GROUP BY payment_mode", [u]),
    q(`SELECT COUNT(*) FILTER (WHERE p.status='Admitted')::int admitted, COALESCE(SUM(b.final_amount),0)::float billed, COALESCE(SUM(b.balance),0)::float outstanding
       FROM indoor_patients p LEFT JOIN indoor_bills b ON b.indoor_patient_id=p.id WHERE p.user_id=$1 AND NOT p.is_deleted`, [u]),
  ]);
  res.json({ today: today.rows[0], month: month.rows[0], total: total.rows[0], daily: daily.rows, payment_modes: modes.rows, indoor: indoor.rows[0] });
}));
const SOURCES = {
  bills: "SELECT sequential_number,date_based_number,patient_name,patient_address,manual_amount,amount,payment_mode,notes,created_at FROM bills WHERE user_id=$1 ORDER BY created_at DESC",
  indoor_patients: "SELECT indoor_id,patient_name,age,gender,contact_number,admission_date,discharge_date,doctor_department,room_bed_no,status FROM indoor_patients WHERE user_id=$1 AND NOT is_deleted",
  indoor_bills: "SELECT b.invoice_number,p.patient_name,b.item_total,b.other_charges,b.final_amount,b.amount_paid,b.balance,b.payment_mode,b.payment_status,b.payment_date FROM indoor_bills b JOIN indoor_patients p ON p.id=b.indoor_patient_id WHERE b.user_id=$1",
};
const csvCell = (v) => { const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
r.get("/export", wrap(async (req, res) => {
  const { type = "bills", format = "csv" } = req.query;
  if (!SOURCES[type]) return res.status(400).json({ error: "Unknown type" });
  const { rows, fields } = await q(SOURCES[type], [req.user.id]);
  const cols = fields.map((f) => f.name), name = `${type}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "json") { res.setHeader("Content-Disposition", `attachment; filename=${name}.json`); return res.json(rows); }
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(type);
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 })); ws.addRows(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${name}.xlsx`); await wb.xlsx.write(res); return res.end();
  }
  res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename=${name}.csv`);
  res.send([cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n"));
}));
export default r;
