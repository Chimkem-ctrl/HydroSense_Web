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
const result = await client.query(`
  select 'profiles' as table_name, count(*)::int as row_count from public.profiles
  union all select 'tanks', count(*)::int from public.tanks
  union all select 'readings', count(*)::int from public.readings
  union all select 'device_statuses', count(*)::int from public.device_statuses
  union all select 'alerts', count(*)::int from public.alerts
  union all select 'thresholds', count(*)::int from public.thresholds
  union all select 'audit_logs', count(*)::int from public.audit_logs
  order by table_name
`);
console.log(JSON.stringify(result.rows, null, 2));
await client.end();
