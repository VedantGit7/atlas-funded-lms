import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// `apps`, `packages` and `src` are pre-F-1 paths that no longer exist, so this
// secret scanner was reading .github, scripts, infrastructure, monitoring and
// tests but **none of the application source** — the largest body of code in
// the repo and the likeliest place for a committed credential.
const scanRoots = [
  ".github",
  "backend",
  "frontend",
  "scripts",
  "infrastructure",
  "monitoring",
  "runbooks",
  "tests",
];

/** A guard that cannot find its input must fail, never pass quietly. */
const MIN_EXPECTED_FILES = 500;

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
  // The repo integrates Stripe and Razorpay, and
  // `backend/packages/tenant-config/src/validate.ts` already rejects `sk_live_`
  // in tenant manifests — but the repo-wide scanner did not look for it, so a
  // live payment key in application source would have passed.
  {
    name: "Stripe live secret key",
    pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}/,
  },
  {
    name: "Razorpay live key secret",
    pattern: /\brzp_live_[A-Za-z0-9]{10,}/,
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

if (files.length < MIN_EXPECTED_FILES) {
  console.error(
    `check-secrets: scanned only ${files.length} files (expected at least ${MIN_EXPECTED_FILES}); scan roots are stale.`,
  );
  process.exit(1);
}

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
