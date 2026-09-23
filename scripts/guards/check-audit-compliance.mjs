import { isGeneratedSourcePath } from "./source-paths.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Sensitive mutations must write same-transaction audit entries.
 *
 * Three defects were fixed here on 2026-08-19, all of which made this guard
 * report success while proving nothing:
 *
 * 1. **Stale roots.** `rootsToScan` was still `["apps", "packages", "src"]`.
 *    None survived the F-1 backend/frontend split, `walkFiles` swallowed the
 *    ENOENT, and the guard scanned **zero files** on every CI run. A vacuity
 *    floor now makes that impossible to repeat silently.
 *
 * 2. **Substring matching.** `content.includes("createTenant")` matched
 *    `createTenantRoute`, which every route file imports — so the trigger fired
 *    on 913 files that mutate nothing. Terms are matched on word boundaries.
 *
 * 3. **Single-file view.** The audit property is declared in route metadata,
 *    which usually lives in a sibling `route.metadata.ts` or a shared
 *    `*.route-metadata.ts` module. Reading only the route file made every one
 *    of those look unaudited. Metadata imports are now followed one hop — the
 *    same fix the authorization suite needed when it read only `page.tsx`.
 *
 * Frontend files are out of scope: they cannot write an audit entry.
 * `ci:audit-metadata` (`check-sensitive-route-audit.ts`) is the precise,
 * permission-driven counterpart to this heuristic and remains the primary gate.
 */
const rootsToScan = ["backend/apps", "backend/packages"];

/** A guard that cannot find its input must fail, never pass quietly. */
const MIN_EXPECTED_FILES = 500;

/**
 * Deliberately identifier-shaped, not English words.
 *
 * `publish`, `unpublish`, `grade` and `moderate` were removed: as bare words
 * they match permission identifiers (`"course.publish"` — `.` is a word
 * boundary), error copy ("Course publish workflow is not configured"),
 * permission matrices, seeds and authorization predicates. Every one of the 27
 * files they flagged was prose or a permission string, not a mutation, so they
 * could only ever produce noise or be ignored.
 *
 * Route-level coverage for those operations is not lost: `ci:audit-metadata`
 * checks them by permission against declared route metadata, which is the
 * precise version of this rule. This heuristic exists to catch mutation
 * helpers that never reach a route.
 */
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
  "issueCertificate",
  "revokeCertificate",
  "exportData",
  "deleteData",
];

/**
 * Match a *definition*, not a call.
 *
 * `await issueCertificate(...)` in a worker or an orchestrating service is a
 * delegation to the module that owns the operation and writes the audit entry;
 * flagging the caller reports the wrong file. Covers
 * `function x`, `const x =`, `x: (` / `x: async (`, and `async x(` methods.
 */
const mutationPatterns = mutationTerms.map((term) => ({
  term,
  pattern: new RegExp(
    [
      `(?:function|const|let|var)\\s+${term}\\b`,
      `\\b${term}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\()`,
      `\\basync\\s+${term}\\s*\\(`,
    ].join("|"),
  ),
}));

/**
 * Repositories are the persistence layer. Audit entries are written by the
 * service that orchestrates them — `auditWriter` lives in `*.service.ts`
 * throughout this codebase — so a repository method named after a sensitive
 * mutation is the expected shape, not a gap.
 */
const isRepository = (file) => /\.repository\.ts$/.test(file.replaceAll("\\", "/"));

function walkFiles(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      const normalized = path.replaceAll("\\", "/");

      if (
        isGeneratedSourcePath(normalized) ||
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

function mentionsAudit(content) {
  return /\baudit/i.test(content);
}

/**
 * Strip `import ... from "..."` and `export ... from "..."` statements.
 *
 * A file that imports `issueCertificate` or re-exports `suspendTenant` is
 * delegating to the module that owns the operation — and its audit write.
 * Matching those made barrel files and every caller look unaudited: all five
 * remaining failures were call sites whose target does write an audit entry
 * (`certificate.service`, `member-admin.service`). The rule is about where a
 * mutation is *defined*, so only the rest of the file is searched.
 */
function withoutModuleSpecifiers(content) {
  return content
    .replace(/^\s*import\s[\s\S]*?from\s+"[^"]*";?\s*$/gm, "")
    .replace(/^\s*export\s[\s\S]*?from\s+"[^"]*";?\s*$/gm, "")
    .replace(/^\s*import\s+"[^"]*";?\s*$/gm, "");
}

/**
 * Resolve the modules a file pulls route metadata from, so a route whose audit
 * property is declared next door is not reported as unaudited.
 */
function readMetadataSources(file, content) {
  const sources = [];
  const here = dirname(file);

  const sibling = join(here, "route.metadata.ts");
  if (existsSync(sibling)) sources.push(sibling);

  for (const match of content.matchAll(/from\s+"([^"]*route-metadata[^"]*)"/g)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const candidate = resolve(here, `${specifier}.ts`);
    if (existsSync(candidate)) sources.push(candidate);
  }

  return sources;
}

const files = rootsToScan.flatMap((root) => walkFiles(root)).filter((file) => /\.ts$/.test(file));

if (files.length < MIN_EXPECTED_FILES) {
  console.error(
    `check-audit-compliance: scanned only ${files.length} files (expected at least ${MIN_EXPECTED_FILES}); scan roots are stale.`,
  );
  process.exit(1);
}

const failures = [];

for (const file of files) {
  if (isRepository(file)) continue;

  const content = readFileSync(file, "utf8");
  const body = withoutModuleSpecifiers(content);

  const matched = mutationPatterns.find(({ pattern }) => pattern.test(body));
  if (!matched) continue;

  if (mentionsAudit(content)) continue;

  const declaredNextDoor = readMetadataSources(file, content).some((source) =>
    mentionsAudit(readFileSync(source, "utf8")),
  );
  if (declaredNextDoor) continue;

  failures.push(`${file.replaceAll("\\", "/")} (matched "${matched.term}")`);
}

if (failures.length > 0) {
  console.error("\nBlocked CI: sensitive mutation-like files must include audit handling.\n");
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  console.error("\nSensitive mutations must write same-transaction audit entries.\n");
  process.exit(1);
}

console.log(`check-audit-compliance: OK (${files.length} files scanned).`);
process.exit(0);
