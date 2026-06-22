import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const scanRoots = [
  ".github",
  "apps",
  "packages",
  "scripts",
  "infrastructure",
  "monitoring",
  "runbooks",
  "src",
  "tests",
];

const allowedFiles = new Set([".env.example"]);

const secretPatterns = [
  {
    name: "Generic private key",
    pattern: /-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----/,
  },
  {
    name: "Supabase service role JWT-like value",
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  },
  {
    name: "Database URL",
    pattern: /postgres(ql)?:\/\/[^"'`\s]+:[^"'`\s]+@[^"'`\s]+/,
  },
  {
    name: "Cloudflare token-like value",
    pattern: /CLOUDFLARE_API_TOKEN\s*=\s*[A-Za-z0-9_-]{20,}/,
  },
  {
    name: "AWS-style access key",
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: "Long bearer token",
    pattern: /Bearer\s+[A-Za-z0-9._-]{40,}/,
  },
];

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
        normalized.includes("/coverage/") ||
        normalized.includes("/docs/locked/")
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

const files = scanRoots
  .flatMap((root) => walkFiles(root))
  .filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    const fileName = normalized.split("/").at(-1);

    if (!fileName) {
      return false;
    }

    if (allowedFiles.has(fileName)) {
      return false;
    }

    return /\.(ts|tsx|js|mjs|cjs|json|yaml|yml|md|env|txt|sh)$/.test(fileName);
  });

const failures = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const normalized = file.replaceAll("\\", "/");

  for (const { name, pattern } of secretPatterns) {
    if (pattern.test(content)) {
      if (
        name === "Database URL" &&
        normalized.includes(".github/workflows/") &&
        content.includes("CI_DATABASE_URL")
      ) {
        continue;
      }

      if (name === "Database URL" && normalized.startsWith("tests/")) {
        continue;
      }

      failures.push(`${file}: ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error("\nBlocked CI: possible secret detected.\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("\nRotate any committed secret immediately. Do not rely only on deletion.\n");
  process.exit(1);
}

process.exit(0);
