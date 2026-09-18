import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Both spellings are listed: the pre-F-1 roots (in case they reappear) and the
// current backend/ + frontend/ locations. Listing only the old paths meant a
// forbidden tenant-specific package created at the new location went undetected.
const forbiddenPaths = [
  "packages/fundedbeyond",
  "packages/trading",
  "packages/prop-firm",
  "packages/challenges",
  "apps/fundedbeyond",
  "apps/academy",
  "backend/packages/fundedbeyond",
  "backend/packages/trading",
  "backend/packages/prop-firm",
  "backend/packages/challenges",
  "backend/apps/fundedbeyond",
  "backend/apps/academy",
  "frontend/packages/fundedbeyond",
  "frontend/packages/trading",
  "frontend/packages/prop-firm",
  "frontend/packages/challenges",
  "frontend/apps/fundedbeyond",
  "frontend/apps/academy",
];

const forbiddenSourceTerms = [
  "packages/fundedbeyond",
  "@fundedbeyond/",
  "createChallengePurchase",
  "challengeCheckout",
  "tradingAccount",
  "mt5Account",
  "matchTraderAccount",
  "mobileBuildEndpoint",
  "pluginMarketplace",
  "aiCoachAutoPublish",
];

// Phase 0 fixed `forbiddenPaths` above to cover backend/ and frontend/, but
// left these source-term scan roots on the pre-F-1 spelling. `apps`,
// `packages` and root `prisma` no longer exist (it is `backend/prisma`), so the
// forbidden-term half of this guard scanned essentially nothing while the
// path-existence half kept working — a guard that was half-live and read as
// fully green.
const scanRoots = [
  "backend/apps",
  "backend/packages",
  "backend/prisma",
  "frontend/apps",
  "frontend/packages",
];

/** A guard that cannot find its input must fail, never pass quietly. */
const MIN_EXPECTED_FILES = 500;

const failures = [];

for (const path of forbiddenPaths) {
  if (existsSync(path)) {
    failures.push(`Forbidden path exists: ${path}`);
  }
}

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

const files = scanRoots
  .flatMap((root) => walkFiles(root))
  .filter((file) => /\.(ts|tsx|js|mjs|cjs|prisma|sql)$/.test(file));

if (files.length < MIN_EXPECTED_FILES) {
  console.error(
    `check-forbidden-scope: scanned only ${files.length} files (expected at least ${MIN_EXPECTED_FILES}); scan roots are stale.`,
  );
  process.exit(1);
}

for (const file of files) {
  const content = readFileSync(file, "utf8");

  for (const term of forbiddenSourceTerms) {
    if (content.includes(term)) {
      failures.push(`${file} contains forbidden scope term: ${term}`);
    }
  }
}

if (failures.length > 0) {
  console.error("\nBlocked CI: forbidden product scope detected.\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(
    "\nDo not create Phase 2-4 scope, challenge purchase flows, trading-account flows, or FundedBeyond code forks.\n",
  );
  process.exit(1);
}

process.exit(0);
