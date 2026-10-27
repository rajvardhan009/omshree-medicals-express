import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { q } from "../db/pool.js";
import { requireAuth, wrap } from "../middleware/auth.js";
const r = Router();
const sign = (u) => jwt.sign({ id: u.id, email: u.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
r.post("/signup", wrap(async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: "Email and 6+ char password required" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows: [u] } = await q("INSERT INTO users (email,password_hash,full_name) VALUES ($1,$2,$3) RETURNING id,email,full_name", [email.toLowerCase(), hash, full_name || null]);
    res.status(201).json({ token: sign(u), user: u });
  } catch (e) { if (e.code === "23505") return res.status(409).json({ error: "Email already registered" }); throw e; }
}));
r.post("/login", wrap(async (req, res) => {
  const { email, password } = req.body;
  const { rows: [u] } = await q("SELECT * FROM users WHERE email=$1", [String(email || "").toLowerCase()]);
  if (!u || !(await bcrypt.compare(password || "", u.password_hash))) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: sign(u), user: { id: u.id, email: u.email, full_name: u.full_name } });
}));
r.get("/me", requireAuth, wrap(async (req, res) => {
  const { rows: [u] } = await q("SELECT id,email,full_name,created_at FROM users WHERE id=$1", [req.user.id]);
  res.json(u);
}));
r.put("/me", requireAuth, wrap(async (req, res) => {
  const { rows: [u] } = await q("UPDATE users SET full_name=$2 WHERE id=$1 RETURNING id,email,full_name,created_at", [req.user.id, String(req.body.full_name || "")]);
  res.json(u);
}));
export default r;
