// One-command setup: asks for your Neon URL, writes .env files,
// tests the connection, then creates tables + demo data.
// Usage: npm install && npm run setup

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import readline from "node:readline/promises";
import pg from "pg";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\nJan Seva setup\n");
let url = (await rl.question("Paste your Neon DATABASE_URL: ")).trim();
rl.close();

if (!url.startsWith("postgres")) {
  console.error("That doesn't look like a Postgres URL.");
  process.exit(1);
}

// channel_binding=require often breaks the node "pg" driver, so drop it.
url = url.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");

writeFileSync(
  new URL("../.env", import.meta.url),
  `DATABASE_URL=${url}\nPORT=4000\nCORS_ORIGIN=http://localhost:5173\n`
);
console.log("backend/.env written.");

const frontendEnv = new URL("../../frontend/.env", import.meta.url);
if (!existsSync(frontendEnv)) {
  writeFileSync(frontendEnv, "VITE_API_URL=http://localhost:4000/api\n");
  console.log("frontend/.env written.");
}

const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query("SELECT 1");
  console.log("Connected to Neon.");
  await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  await pool.query(readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8"));
  console.log("Tables and demo data created.\n\nDone. Now run: npm run dev");
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
