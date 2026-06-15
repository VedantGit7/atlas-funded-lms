import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const rootsToScan = ["apps", "packages", "src"];
const mutationTerms = [
  "createTenant",
  "updateTenant",
  "deleteTenant",
  "suspendTenant",
  "inviteMember",
  "removeMember",
  "assignRole",
  "revokeRole",
  "overridePermission",
  "publish",
  "unpublish",
  "grade",
  "issueCertificate",
  "revokeCertificate",
  "moderate",
  "exportData",
  "deleteData",
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

  const looksLikeSensitiveMutation = mutationTerms.some((term) => content.includes(term));

  if (!looksLikeSensitiveMutation) {
    continue;
  }

  const hasAuditReference =
    content.includes("audit") ||
    content.includes("Audit") ||
    content.includes("writeAudit") ||
    content.includes("auditLog");

  if (!hasAuditReference) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked CI: sensitive mutation-like files must include audit handling.\n");
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  console.error("\nSensitive mutations must write same-transaction audit entries.\n");
  process.exit(1);
}

process.exit(0);
