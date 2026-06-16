import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const guardScriptPath = resolve(fileURLToPath(import.meta.url));
const roots = ["prisma", "scripts", "packages", "apps"];
const failures = [];

function walkFiles(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      const normalized = path.replaceAll("\\", "/");

      if (
        normalized.includes("/node_modules/") ||
        normalized.includes("/.next/") ||
        normalized.includes("/dist/") ||
        normalized.includes("/build/") ||
        normalized.includes("/coverage/")
      ) {
        return [];
      }

      const stat = statSync(path);
      return stat.isDirectory() ? walkFiles(path) : [path];
    });
  } catch {
    return [];
  }
}

const files = roots
  .flatMap((root) => walkFiles(root))
  .filter((file) => /\.(sql|ts|tsx|js|mjs|cjs)$/.test(file))
  .filter((file) => resolve(file) !== guardScriptPath);

const forbiddenPatterns = [
  {
    name: "session-level SET app.tenant_id",
    pattern: /\bSET\s+app\.tenant_id\b/,
  },
  {
    name: "session-level SET app.actor_membership_id",
    pattern: /\bSET\s+app\.actor_membership_id\b/,
  },
  {
    name: "session-level SET app.request_id",
    pattern: /\bSET\s+app\.request_id\b/,
  },
  {
    name: "set_config app.tenant_id with false",
    pattern: /\bset_config\s*\(\s*['"]app\.tenant_id['"]\s*,\s*[^,]+,\s*false\s*\)/i,
  },
];

function stripComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

for (const file of files) {
  const content = stripComments(readFileSync(file, "utf8"));

  for (const { name, pattern } of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file}: ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error("\nBlocked: unsafe session-level tenant context detected.\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("\nUse transaction-local set_config(..., true) only.\n");
  process.exit(1);
}

process.exit(0);
