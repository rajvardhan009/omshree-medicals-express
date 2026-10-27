import { Router } from "express";
import multer from "multer";
import { wrap } from "../middleware/auth.js";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(f.mimetype)) });
const r = Router();
const PROMPT = `Read this pharmacy/medical bill image. Reply ONLY with JSON:
{"patient_name":string,"patient_address":string,"products":[{"name":string,"quantity":number,"mrp":number}],"total":number,"notes":string}
Use "" or 0 when unknown. mrp is the per-unit price.`;
function parse(text) {
  const m = String(text).match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : {};
  return { patient_name: j.patient_name || "", patient_address: j.patient_address || "", total: Number(j.total) || 0, notes: j.notes || "",
    products: (j.products || []).map((p) => ({ name: String(p.name || ""), quantity: Number(p.quantity) || 1, mrp: Number(p.mrp) || 0 })) };
}
r.post("/analyze-bill", upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload a JPG, PNG or WebP up to 10MB as 'file'" });
  const b64 = req.file.buffer.toString("base64");
  let text;
  if (process.env.AI_PROVIDER === "openai") {
    const r2 = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" },
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT + " json" }, { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${b64}` } }] }] }) });
    if (!r2.ok) return res.status(r2.status).json({ error: "AI service error" });
    text = (await r2.json()).choices[0].message.content;
  } else {
    const r2 = await fetch(`${process.env.OLLAMA_URL || "http://localhost:11434"}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "llama3.2-vision", stream: false, format: "json",
        messages: [{ role: "user", content: PROMPT, images: [b64] }] }) });
    if (!r2.ok) return res.status(502).json({ error: "Ollama not reachable" });
    text = (await r2.json()).message.content;
  }
  try { res.json(parse(text)); } catch { res.status(422).json({ error: "Could not read this bill" }); }
}));
export default r;
