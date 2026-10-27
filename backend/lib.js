export const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const billTotal = (manual, products = []) =>
  num(num(manual) + products.reduce((s, p) => s + num(p.quantity) * num(p.mrp), 0));
export const paymentStatus = (balance, paid) => (balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");
export const ymd = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");
export const lockUser = (c, userId, key) => c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId + key]);
export async function createBill(c, userId, b) {
  await lockUser(c, userId, "bill");
  if (b.id) {
    const { rows: [existing] } = await c.query("SELECT * FROM bills WHERE id=$1 AND user_id=$2", [b.id, userId]);
    if (existing) return existing;
  }
  const { rows: [s] } = await c.query("SELECT COALESCE(MAX(sequential_number),0)+1 n FROM bills WHERE user_id=$1", [userId]);
  const day = ymd();
  const { rows: [d] } = await c.query("SELECT COALESCE(MAX(split_part(date_based_number,'-',2)::int),0)+1 n FROM bills WHERE user_id=$1 AND date_based_number LIKE $2", [userId, day + "-%"]);
  const products = Array.isArray(b.products) ? b.products : [];
  const { rows: [bill] } = await c.query(
    `INSERT INTO bills (id,user_id,sequential_number,date_based_number,patient_name,patient_address,products,manual_amount,amount,payment_mode,notes)
     VALUES (COALESCE($1,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [b.id || null, userId, s.n, `${day}-${String(d.n).padStart(3, "0")}`, b.patient_name, b.patient_address || null,
     JSON.stringify(products), num(b.manual_amount), billTotal(b.manual_amount, products), b.payment_mode || "Cash", b.notes || null]);
  return bill;
}
export async function updateBill(c, userId, id, b) {
  const products = Array.isArray(b.products) ? b.products : [];
  const { rows: [bill] } = await c.query(
    `UPDATE bills SET patient_name=$3,patient_address=$4,products=$5,manual_amount=$6,amount=$7,payment_mode=$8,notes=$9,updated_at=now()
     WHERE id=$1 AND user_id=$2 RETURNING *`,
    [id, userId, b.patient_name, b.patient_address || null, JSON.stringify(products), num(b.manual_amount),
     billTotal(b.manual_amount, products), b.payment_mode || "Cash", b.notes || null]);
  return bill;
}
