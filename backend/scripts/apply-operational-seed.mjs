import fs from "node:fs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "./backend/.env.local" });

const client = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.iafooterjwbihuzwakoc",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(fs.readFileSync("./backend/supabase/migrations/20261107230000_operational_seed.sql", "utf8"));
await client.end();
console.log("Operational seed applied.");
