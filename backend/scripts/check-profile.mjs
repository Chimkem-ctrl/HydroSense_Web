import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env.local", import.meta.url) });

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const result = await client.query(
  "select email,status,employee_id,phone,address,emergency_contact_name,emergency_contact_phone from profiles where email like $1 order by created_at desc limit 5",
  ["browser2.test.%"],
);
console.log(result.rows);
await client.end();
