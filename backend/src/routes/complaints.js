
import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  TIMELINE_STEPS,
  doneCountFor,
  todayISO,
} from "../utils/timeline.js";

const router = Router();

// Convert database complaint + timeline into frontend format.
function toComplaintDTO(row, timelineRows = []) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    location: row.location,
    lat: row.lat,
    lng: row.lng,
    photo: row.photo_url,
    status: row.status,

    // AI priority information
    priority: row.priority || "Medium",
    priorityReason: row.priority_reason || "",
    summary: row.summary || "",

    citizenName: row.citizen_name,
    citizenEmail: row.citizen_email,
    date: row.created_at.toISOString().slice(0, 10),

    govRemarks: row.gov_remarks || "",
    resolutionRemarks: row.resolution_remarks || "",
    resolutionPhoto: row.resolution_photo_url,
    resolutionDate: row.resolution_date
      ? row.resolution_date.toISOString().slice(0, 10)
      : null,

    timeline: [...timelineRows]
      .sort((a, b) => a.step_order - b.step_order)
      .map((t) => ({
        label: t.step_label,
        done: t.done,
        date: t.done_date
          ? t.done_date.toISOString().slice(0, 10)
          : null,
      })),
  };
}

async function fetchTimelineFor(complaintIds) {
  if (complaintIds.length === 0) return {};

  const { rows } = await pool.query(
    `SELECT *
     FROM complaint_timeline
     WHERE complaint_id = ANY($1::text[])`,
    [complaintIds]
  );

  const byComplaint = {};

  for (const row of rows) {
    (byComplaint[row.complaint_id] ??= []).push(row);
  }

  return byComplaint;
}

// GET /api/complaints
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS citizen_name, u.email AS citizen_email
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id
       ORDER BY c.created_at DESC`
    );

    const timelineByComplaint = await fetchTimelineFor(
      rows.map((r) => r.id)
    );

    res.json(
      rows.map((r) =>
        toComplaintDTO(r, timelineByComplaint[r.id] || [])
      )
    );
  })
);

// GET /api/complaints/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS citizen_name, u.email AS citizen_email
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Complaint not found.",
      });
    }

    const timelineByComplaint = await fetchTimelineFor([
      req.params.id,
    ]);

    res.json(
      toComplaintDTO(
        rows[0],
        timelineByComplaint[req.params.id] || []
      )
    );
  })
);

// POST /api/complaints
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      category,
      title,
      description,
      location,
      lat,
      lng,
      photo,
      citizenEmail,
      priority,
      priorityReason,
      summary,
    } = req.body;

    if (!category || !title || !description || !citizenEmail) {
      return res.status(400).json({
        error:
          "category, title, description and citizenEmail are required.",
      });
    }

    // Validate AI values; use safe defaults if missing.
    const validPriorities = ["Low", "Medium", "High"];

    const safePriority = validPriorities.includes(priority)
      ? priority
      : "Medium";

    const safePriorityReason =
      typeof priorityReason === "string"
        ? priorityReason
        : "";

    const safeSummary =
      typeof summary === "string" ? summary : "";

    const userResult = await pool.query(
      "SELECT id, name, status FROM users WHERE email = $1",
      [citizenEmail]
    );

    const citizen = userResult.rows[0];

    if (!citizen) {
      return res.status(404).json({
        error: "Citizen account not found.",
      });
    }

    if (citizen.status === "blocked") {
      return res.status(403).json({
        error:
          "This account has been blocked and cannot submit new complaints.",
      });
    }

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM complaints"
    );

    const year = new Date().getFullYear();
    const id = `JS-${year}-${String(
      countRows[0].count + 1
    ).padStart(3, "0")}`;

    const today = todayISO();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO complaints (
          id,
          category,
          title,
          description,
          location,
          lat,
          lng,
          photo_url,
          status,
          citizen_id,
          created_at,
          priority,
          priority_reason,
          summary
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'Pending', $9, now(), $10, $11, $12
        )`,
        [
          id,
          category,
          title,
          description,
          location ?? null,
          lat ?? null,
          lng ?? null,
          photo ?? null,
          citizen.id,
          safePriority,
          safePriorityReason,
          safeSummary,
        ]
      );

      for (let i = 0; i < TIMELINE_STEPS.length; i++) {
        await client.query(
          `INSERT INTO complaint_timeline (
            complaint_id,
            step_order,
            step_label,
            done,
            done_date
          )
          VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            i + 1,
            TIMELINE_STEPS[i],
            i === 0,
            i === 0 ? today : null,
          ]
        );
      }

      await client.query(
        `INSERT INTO notifications (
          role, user_email, message, created_at
        )
        VALUES ($1, $2, $3, $4)`,
        [
          "citizen",
          citizenEmail,
          `Complaint ${id} submitted successfully.`,
          today,
        ]
      );

      await client.query(
        `INSERT INTO notifications (
          role, user_email, message, created_at
        )
        VALUES ($1, $2, $3, $4)`,
        [
          "government",
          null,
          `New complaint ${id} received.`,
          today,
        ]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      `SELECT c.*, u.name AS citizen_name, u.email AS citizen_email
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id
       WHERE c.id = $1`,
      [id]
    );

    const timelineByComplaint = await fetchTimelineFor([id]);

    res.status(201).json(
      toComplaintDTO(
        rows[0],
        timelineByComplaint[id] || []
      )
    );
  })
);

// PATCH /api/complaints/:id/status
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      status,
      govRemarks,
      resolutionRemarks,
      resolutionPhoto,
    } = req.body;

    const validStatuses = [
      "Pending",
      "In Progress",
      "Resolved",
      "Rejected",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of ${validStatuses.join(", ")}`,
      });
    }

    const existing = await pool.query(
      "SELECT * FROM complaints WHERE id = $1",
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Complaint not found.",
      });
    }

    const complaint = existing.rows[0];
    const today = todayISO();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE complaints SET
          status = $1,
          gov_remarks = COALESCE($2, gov_remarks),
          resolution_remarks = COALESCE($3, resolution_remarks),
          resolution_photo_url = COALESCE($4, resolution_photo_url),
          resolution_date = CASE
            WHEN $1 = 'Resolved' THEN $5::date
            ELSE resolution_date
          END
        WHERE id = $6`,
        [
          status,
          govRemarks ?? null,
          resolutionRemarks ?? null,
          resolutionPhoto ?? null,
          today,
          id,
        ]
      );

      const doneCount = doneCountFor(status);

      for (let i = 0; i < TIMELINE_STEPS.length; i++) {
        const done = i < doneCount;

        await client.query(
          `UPDATE complaint_timeline
           SET done = $1,
               done_date = CASE
                 WHEN $1 AND done_date IS NULL THEN $2::date
                 ELSE done_date
               END
           WHERE complaint_id = $3 AND step_order = $4`,
          [done, today, id, i + 1]
        );
      }

      const citizenResult = await client.query(
        "SELECT email FROM users WHERE id = $1",
        [complaint.citizen_id]
      );

      await client.query(
        `INSERT INTO notifications (
          role, user_email, message, created_at
        )
        VALUES ($1, $2, $3, $4)`,
        [
          "citizen",
          citizenResult.rows[0].email,
          `Your complaint ${id} status changed to ${status}.`,
          today,
        ]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      `SELECT c.*, u.name AS citizen_name, u.email AS citizen_email
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id
       WHERE c.id = $1`,
      [id]
    );

    const timelineByComplaint = await fetchTimelineFor([id]);

    res.json(
      toComplaintDTO(
        rows[0],
        timelineByComplaint[id] || []
      )
    );
  })
);

export default router;
