// Applies db/schema.sql then db/seed.sql to the database in DATABASE_URL.
// Usage: npm run db:setup

import { readFileSync } from "node:fs";
import { pool } from "./db.js";

async function main() {
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  const seed = readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");

  console.log("Applying schema.sql...");
  await pool.query(schema);
  console.log("Applying seed.sql...");
  await pool.query(seed);
  console.log("Database ready.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Setup failed:", err.message);
  await pool.end();
  process.exit(1);
});
