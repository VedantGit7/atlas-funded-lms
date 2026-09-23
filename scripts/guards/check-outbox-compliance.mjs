import { isGeneratedSourcePath } from "./source-paths.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Post-F-1 roots. These were still `["apps", "packages", "src"]`, none of which
// survived the backend/frontend split, so `walkFiles` swallowed the ENOENT and
// this guard scanned **zero files** while reporting success on every CI run —
// the same defect `check-audit-compliance` carried.
const rootsToScan = ["backend/apps", "backend/packages", "frontend/apps", "frontend/packages"];

/** A guard that cannot find its input must fail, never pass quietly. */
const MIN_EXPECTED_FILES = 500;

/**
 * Match a side effect being **performed**, not named.
 *
 * A full review of the 26 files this guard reported once its scan roots were
 * fixed found 25 false positives and exactly one real defect. Every false
 * positive was the word appearing as something other than a call:
 *
 * - `"webhook"` as an enum/kind value — SQL (`d.kind = 'webhook'`), type unions
 *   (`"email" | "webhook" | "storage"`), comparisons (`kind === "webhook"`),
 *   and display labels (`webhookLabel: webhookUrl ? "webhook" : null`);
 * - `*_WEBHOOK_SECRET` env names and error copy for **inbound** webhook
 *   *verification* (Stripe, Razorpay) — inbound is the opposite direction from
 *   the outbound dispatch this rule governs;
 * - `sendEmail` as an injected dependency type or a capability flag
 *   (`sendEmail: emailProvider.isConfigured()`);
 * - `issueCertificate` in an `import` from a service that does use the outbox.
 *
 * Requiring a call shape (`name(`) removes all of them, and keeps the real
 * finding. The bare noun `webhook` is dropped entirely: it is a domain word
 * that appears in every export-destination and schedule module, so it can never
 * distinguish dispatching from describing.
 */
const sideEffectTerms = [
  /\bsendEmail\s*\(/,
  /\bsendNotification\s*\(/,
  /\bissueCertificate\s*\(/,
  /\brevokeCertificate\s*\(/,
  /\bupdateProjection\s*\(/,
  /\brebuildProjection\s*\(/,
  /\bemitEvent\s*\(/,
  /\bpublishEvent\s*\(/,
  /posthog\.capture\s*\(/,
  /\bdeliverWebhook\s*\(/,
  /\bdispatch\w*Webhooks?\s*\(/,
];

/** Terms may be plain substrings or regexes; normalise the test. */
const matchesTerm = (content, term) =>
  typeof term === "string" ? content.includes(term) : term.test(content);

/**
 * Imports and `export … from` re-exports name the module that owns the effect;
 * the importer is delegating to it. Same reasoning as `check-audit-compliance`.
 */
function withoutModuleSpecifiers(content) {
  return content
    .replace(/^\s*import\s[\s\S]*?from\s+["'][^"']*["'];?\s*$/gm, "")
    .replace(/^\s*export\s[\s\S]*?from\s+["'][^"']*["'];?\s*$/gm, "")
    .replace(/^\s*import\s+["'][^"']*["'];?\s*$/gm, "");
}

const EXEMPT_FILE_PATTERNS = [
  /route\.metadata\.ts$/,
  /\.route-metadata\.ts$/,
  /\/modules\/.*\.api\.ts$/,
  /posthog-browser\.ts$/,
  // Added 2026-08-19, when the stale scan roots were fixed and this guard began
  // reading files for the first time. The `webhook` term matches any file that
  // merely *names* the concept, so declaration-only modules dominated the
  // output without describing a single dispatch:
  //   - generated Prisma models (not authored here at all)
  //   - DTOs and schema modules, which declare shapes and perform no effects
  /\/generated\//,
  /\.dto\.ts$/,
  /\.schemas?\.ts$/,
  /\.d\.ts$/,
  // `safeOutboundFetch` is the sanctioned outbound-HTTP wrapper introduced by
  // the SSRF work (2.4). It performs the request every webhook delivery funnels
  // through, so it necessarily "looks like" a side effect — it is the
  // mechanism, not an un-outboxed caller of one.
  /\/security\/src\/safe-outbound-fetch\.ts$/,
];

function walkFiles(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      const normalized = path.replaceAll("\\", "/");

      if (
        isGeneratedSourcePath(normalized) ||
        normalized.includes("/.next/") ||
        normalized.includes("/dist/") ||
        normalized.includes("/build/")
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

/**
 * Opt-out marker, written at the site with a reason:
 *
 * ```ts
 * // outbox-exempt: admin-initiated connectivity test must report synchronously
 * ```
 *
 * Preferred over a path list in this file, because the justification lives next
 * to the code it excuses and travels with it. The reason is required — a bare
 * marker does not exempt anything.
 */
const EXEMPT_MARKER = /\/\/\s*outbox-exempt:\s*\S+/;

function isExemptFile(normalizedPath, content) {
  if (content.includes('"use client"') || content.includes("'use client'")) {
    return true;
  }

  if (EXEMPT_MARKER.test(content)) {
    return true;
  }

  return EXEMPT_FILE_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

function resolveRelativeImport(fromFile, importPath) {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const base = resolve(dirname(fromFile), importPath);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectImportedFiles(filePath, content, visited = new Set()) {
  if (visited.has(filePath)) {
    return [];
  }
  visited.add(filePath);

  const imports = [...content.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .map((importPath) => resolveRelativeImport(filePath, importPath))
    .filter((path) => path != null);

  const nested = imports.flatMap((imported) => {
    const importedContent = readFileSync(imported, "utf8");
    return [imported, ...collectImportedFiles(imported, importedContent, visited)];
  });

  return nested;
}

function hasOutboxReference(content) {
  return (
    content.includes("outbox") ||
    content.includes("Outbox") ||
    content.includes("writeOutbox") ||
    content.includes("enqueueOutbox")
  );
}

/**
 * Files that import this one. A module invoked *by* an outbox handler is on an
 * approved path even though nothing in it mentions the outbox —
 * `reports-delivery.ts` is the case that proved this: it is called only from
 * `handleReportDeliveryOutboxEvent`, so looking only downstream reported the
 * delivery module while the handler that governs it sat one hop above.
 */
let importerIndex = null;

function buildImporterIndex(allFiles) {
  const index = new Map();
  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/from\s+["']([^"']+)["']/g)) {
      const target = resolveRelativeImport(file, match[1]);
      if (!target) continue;
      const key = target.replaceAll("\\", "/");
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(file);
    }
  }
  return index;
}

function fileHasApprovedOutboxPath(filePath, content) {
  if (hasOutboxReference(content)) {
    return true;
  }

  const normalized = filePath.replaceAll("\\", "/");

  // Downstream: the module that owns the effect governs it. An importer that
  // merely calls `issueCertificate(...)` is delegating to a service which does
  // enqueue an outbox event.
  const importedFiles = collectImportedFiles(filePath, content);
  if (importedFiles.some((imported) => hasOutboxReference(readFileSync(imported, "utf8")))) {
    return true;
  }

  // Upstream: invoked from an outbox handler.
  //
  // `every`, not `some`, and deliberately so. A module reached by *both* an
  // outbox handler and a direct request-path caller is exactly the defect this
  // rule exists to catch — `some` cleared `marketing-integrations.dispatch.ts`
  // on the strength of one well-behaved importer while the signup route was
  // still calling it inline.
  if (importerIndex) {
    const importers = importerIndex.get(resolve(filePath).replaceAll("\\", "/")) ?? [];
    if (
      importers.length > 0 &&
      importers.every((importer) => hasOutboxReference(readFileSync(importer, "utf8")))
    ) {
      return true;
    }
  }

  if (normalized.includes(".repository.ts")) {
    const serviceCandidate = normalized.replace(".repository.ts", ".service.ts");
    if (
      existsSync(serviceCandidate) &&
      hasOutboxReference(readFileSync(serviceCandidate, "utf8"))
    ) {
      return true;
    }
  }

  return false;
}

const files = rootsToScan
  .flatMap((root) => walkFiles(root))
  .filter((file) => /\.(ts|tsx)$/.test(file));

importerIndex = buildImporterIndex(files);

if (files.length < MIN_EXPECTED_FILES) {
  console.error(
    `check-outbox-compliance: scanned only ${files.length} files (expected at least ${MIN_EXPECTED_FILES}); scan roots are stale.`,
  );
  process.exit(1);
}

const failures = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const normalized = file.replaceAll("\\", "/");

  if (isExemptFile(normalized, content)) {
    continue;
  }

  const body = withoutModuleSpecifiers(content);
  const looksLikeSideEffect = sideEffectTerms.some((term) => matchesTerm(body, term));
  if (!looksLikeSideEffect) {
    continue;
  }

  if (!fileHasApprovedOutboxPath(file, content)) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked CI: side-effect-like files must use the outbox pattern.\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("\nSide effects must go through approved outbox handling.\n");
  process.exit(1);
}

process.exit(0);
