import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// GET /api/notifications?role=citizen&email=citizen@test.com
// GET /api/notifications?role=government
router.get("/", asyncHandler(async (req, res) => {
  const { role, email } = req.query;

  let query = "SELECT * FROM notifications WHERE role = $1";
  const params = [role || "citizen"];
  if (role === "citizen") {
    query += " AND user_email = $2";
    params.push(email || "");
  }
  query += " ORDER BY created_at DESC LIMIT 20";

  const { rows } = await pool.query(query, params);
  res.json(
    rows.map((r) => ({
      id: r.id,
      role: r.role,
      email: r.user_email,
      message: r.message,
      read: r.read,
      date: r.created_at.toISOString().slice(0, 10),
    }))
  );
}));

export default router;
