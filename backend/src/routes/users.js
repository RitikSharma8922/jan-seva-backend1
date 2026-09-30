import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// GET /api/users
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status,
            COUNT(c.id)::int AS complaints_count
     FROM users u
     LEFT JOIN complaints c ON c.citizen_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at ASC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: r.status,
      complaintsCount: r.complaints_count,
    }))
  );
}));

// PATCH /api/users/:id/status   body: { status: "active" | "blocked" }
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "blocked"].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'blocked'." });
  }

  const { rows } = await pool.query(
    "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, phone, status",
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "User not found." });

  res.json(rows[0]);
}));

export default router;
