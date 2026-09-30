import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// POST /api/auth/citizen/login
router.post("/citizen/login", asyncHandler(async (req, res) => {
  const { emailOrPhone, password } = req.body;
  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: "emailOrPhone and password are required." });
  }

  const { rows } = await pool.query(
    `SELECT id, name, email, phone, status FROM users
     WHERE (email = $1 OR phone = $1) AND password = $2`,
    [emailOrPhone, password]
  );
  const user = rows[0];

  if (!user) return res.status(401).json({ error: "Invalid email/mobile or password." });
  if (user.status === "blocked") {
    return res.status(403).json({ error: "This account has been blocked by the municipal office." });
  }

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: "citizen" } });
}));

// POST /api/auth/citizen/register
router.post("/citizen/register", asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "name, email, phone and password are required." });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  const id = `U-${1000 + countRows[0].count + 1}`;

  await pool.query(
    `INSERT INTO users (id, name, email, phone, password, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [id, name, email, phone, password]
  );

  res.status(201).json({ user: { id, name, email, role: "citizen" } });
}));

// POST /api/auth/government/login
router.post("/government/login", asyncHandler(async (req, res) => {
  const { id, password } = req.body;
  const { rows } = await pool.query(
    "SELECT id, name FROM officers WHERE id = $1 AND password = $2",
    [id, password]
  );
  const officer = rows[0];

  if (!officer) return res.status(401).json({ error: "Invalid Government ID or password." });

  res.json({ officer: { id: officer.id, name: officer.name, role: "government" } });
}));

export default router;
