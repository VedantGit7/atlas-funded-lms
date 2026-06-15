import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const forbiddenPaths = [
  "packages/fundedbeyond",
  "packages/trading",
  "packages/prop-firm",
  "packages/challenges",
  "apps/fundedbeyond",
  "apps/academy",
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

const scanRoots = ["apps", "packages", "src", "prisma"];

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
