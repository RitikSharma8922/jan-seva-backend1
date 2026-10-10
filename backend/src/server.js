
import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import complaintsRoutes from "./routes/complaints.js";
import usersRoutes from "./routes/users.js";
import notificationsRoutes from "./routes/notifications.js";
import aiRoutes from "./ai.js";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173"
}));

app.use(express.json({ limit: "8mb" }));

// Existing API routes
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);

// Gemini AI route
app.use("/api/ai", aiRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Something went wrong on the server."
  });
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Nagar Mitra API listening on port ${port}`);
});
