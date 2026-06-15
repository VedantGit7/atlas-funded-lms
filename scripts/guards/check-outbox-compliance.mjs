import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const rootsToScan = ["apps", "packages", "src"];

const sideEffectTerms = [
  "sendEmail",
  "sendNotification",
  "issueCertificate",
  "revokeCertificate",
  "updateProjection",
  "rebuildProjection",
  "emitEvent",
  "publishEvent",
  "posthog.capture",
  "webhook",
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

const files = rootsToScan
  .flatMap((root) => walkFiles(root))
  .filter((file) => /\.(ts|tsx)$/.test(file));

const failures = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");

  const looksLikeSideEffect = sideEffectTerms.some((term) => content.includes(term));

  if (!looksLikeSideEffect) {
    continue;
  }

  const hasOutboxReference =
    content.includes("outbox") ||
    content.includes("Outbox") ||
    content.includes("writeOutbox") ||
    content.includes("enqueueOutbox");

  if (!hasOutboxReference) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked CI: side-effect-like files must use the outbox pattern.\n");
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  console.error("\nSide effects must go through approved outbox handling.\n");
  process.exit(1);
}

process.exit(0);
