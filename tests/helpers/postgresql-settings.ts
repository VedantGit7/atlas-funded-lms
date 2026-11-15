import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** deploy/coolify/postgresql-settings.sql: its ALTER SYSTEM settings and the limits it is sized for. */
export function readPostgresqlSettings(): {
  sql: string;
  settings: Map<string, string>;
  cpus: number;
  memoryMb: number;
} {
  const sql = readFileSync(resolve("deploy/coolify/postgresql-settings.sql"), "utf8");
  const settings = new Map<string, string>();
  for (const match of sql.matchAll(/^ALTER SYSTEM SET ([a-z_.]+) = (.+);$/gm))
    settings.set(match[1] ?? "", (match[2] ?? "").replace(/^'|'$/g, ""));
  const limits = /^-- coolify-limits: cpus=(\d+) memory=(\d+)GB$/m.exec(sql);
  return { sql, settings, cpus: Number(limits?.[1]), memoryMb: Number(limits?.[2]) * 1024 };
}

/** A PostgreSQL size setting such as '1536MB' or '4GB', in megabytes. */
export function megabytes(value: string | undefined): number {
  const match = /^(\d+)(kB|MB|GB)$/.exec(value ?? "");
  if (!match) throw new Error(`not a size: ${String(value)}`);
  const amount = Number(match[1]);
  return match[2] === "GB" ? amount * 1024 : match[2] === "MB" ? amount : amount / 1024;
}
