import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectDirectory = fileURLToPath(new URL("../supabase/", import.meta.url));
const supabase = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["supabase", "functions", "deploy", "api", "--project-ref", "iafooterjwbihuzwakoc", "--yes"];
const result = spawnSync(supabase, args, {
  cwd: projectDirectory,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
