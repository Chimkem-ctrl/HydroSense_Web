import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });

const databasePassword = process.env.SUPABASE_DB_PASSWORD;
if (!databasePassword) {
  throw new Error("SUPABASE_DB_PASSWORD must be set.");
}

const migrationFiles = (await fs.readdir(new URL("../supabase/migrations/", import.meta.url)))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "db.iafooterjwbihuzwakoc.supabase.co",
  port: Number(process.env.SUPABASE_DB_PORT ?? "5432"),
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  user: process.env.SUPABASE_DB_USER ?? "postgres",
  password: databasePassword,
  ssl: { rejectUnauthorized: false },
  ...(process.env.SUPABASE_DB_HOST?.includes(":") ? { host: process.env.SUPABASE_DB_HOST, family: 6 } : {}),
});

await client.connect();
try {
  if (process.env.RESET_PUBLIC_SCHEMA === "true") {
    await client.query(`
      drop schema if exists public cascade;
      create schema public;
      grant usage on schema public to postgres, anon, authenticated, service_role;
      grant all on schema public to postgres, service_role;
      grant all on all tables in schema public to anon, authenticated, service_role;
      grant all on all sequences in schema public to anon, authenticated, service_role;
    `);
  }
  for (const migrationFile of migrationFiles) {
    const migrationUrl = new URL(`../supabase/migrations/${migrationFile}`, import.meta.url);
    const sql = await fs.readFile(migrationUrl, "utf8");
    await client.query(sql);
    console.log(`Applied ${migrationFile}`);
  }
} finally {
  await client.end();
}
