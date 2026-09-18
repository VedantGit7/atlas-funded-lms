import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "backend/apps/api/src/app/api");

/**
 * Route metadata is not only co-located with routes.
 *
 * 252 of the 626 metadata files -- 40% -- live in shared domain packages as
 * `*.route-metadata.ts` and are imported by the route files. They were outside
 * this guard's scan root entirely, so the subject-erasure, payment, live-session
 * and in-app-purchase routes were never checked. The guard reported success
 * across a scan that omitted two fifths of its subject.
 */
const packageMetadataRoots = [join(root, "backend/packages"), join(root, "frontend/packages")];

const SENSITIVE_PERMISSION_PREFIXES = [
  "membership.invite",
  "membership.suspend",
  "membership.remove",
  "role.assign",
  "role.revoke",
  // Changing what a role *is* is as consequential as changing who holds it: a
  // custom role can be edited to carry permissions its holders were never
  // granted, and deleting one silently strips access from everyone assigned it.
  // All three already declared audit: "required" by convention -- listing them
  // here is what stops that convention being edited away unnoticed.
  // `role.read` is deliberately absent: a read needs no audit entry.
  "role.create",
  "role.update",
  "role.delete",
  "permission_override.",
  "branding.update",
  "branding.publish",
  "tenancy.domain.manage",
  "course.publish",
  // Not the bare "workflow." prefix: that swept in `workflow.definition.read`,
  // and a read needs no audit entry.
  "workflow.definition.manage",
  "workflow.transition.act",
  "certificate.issue",
  "certificate.revoke",
  "moderation.",
  "data.export",
  // Was "data.delete", which matches nothing: the permissions are
  // `data.deletion.manage` and `data.deletion.request`, and
  // "data.deletion.manage".startsWith("data.delete") is false at the ninth
  // character. Subject-erasure routes were outside this guard entirely.
  "data.deletion",
  "platform.",
] as const;

const ALLOWED_AUDIT_MODES = new Set(["required", "platform_scope"]);

// Descending into these turns a two-second scan into a two-minute one and finds
// nothing: build output and dependencies contain no route metadata worth
// checking, and dist copies would double-report every violation.
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", ".next", ".turbo", "generated"]);

function walkFiles(directory: string): string[] {
  try {
    return readdirSync(directory).flatMap((entry) => {
      if (SKIP_DIRECTORIES.has(entry)) return [];
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      return stat.isDirectory() ? walkFiles(fullPath) : [fullPath];
    });
  } catch {
    return [];
  }
}

type MetadataBlock = {
  exportName: string;
  permission: string | undefined;
  audit: string | undefined;
};

/**
 * Split a metadata file into its exported blocks and read each one separately.
 *
 * This used to run `content.match(...)` over the whole file. `String.match`
 * without the global flag returns only the FIRST match, so a file exporting more
 * than one metadata block — which is most of them, since a GET and its mutation
 * live together — was judged on whichever export happened to appear first.
 *
 * The effect was not theoretical. In `members/[id]/route.metadata.ts` the first
 * export is `membership.read` with `audit: "none"`; being a read it is not
 * sensitive, so the file passed and `membership.remove` below it was never
 * examined at all. Removing a member from a tenant could have been made
 * unaudited without this guard noticing. Same shape in `roles/[id]`, where
 * `role.delete` sat behind `role.update`.
 */
function parseRouteMetadataBlocks(content: string): MetadataBlock[] {
  const blocks: MetadataBlock[] = [];
  const exportPattern = /export const (\w+)\s*(?::[^=]+)?=\s*\{/g;

  const starts: Array<{ name: string; index: number }> = [];
  for (const match of content.matchAll(exportPattern)) {
    starts.push({ name: match[1] ?? "unknown", index: match.index ?? 0 });
  }

  for (const [i, start] of starts.entries()) {
    const end = starts[i + 1]?.index ?? content.length;
    const body = content.slice(start.index, end);

    const permission = /permission:\s*["']([^"']+)["']/.exec(body)?.[1];
    const audit = /audit:\s*["']([^"']+)["']/.exec(body)?.[1];

    blocks.push({ exportName: start.name, permission, audit });
  }

  return blocks;
}

const SAFE_VERBS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Map metadata export name -> HTTP verb, by reading the route file beside it.
 *
 * Needed because a permission key does not imply a mutation. `data.export.run`
 * guards the list, the fetch-one *and* the create; requiring an audit entry on
 * all three would demand audit rows for ordinary reads, and dropping the
 * permission from the list would stop guarding the create. The verb is what
 * separates them, and the route file is where the binding lives.
 */
/**
 * Verb bindings across every route file, keyed by metadata export name.
 *
 * Metadata defined in a package has no sibling route file, so the binding has to
 * come from wherever it is imported. Names are distinctive in practice
 * (`createExportMetadata`, `processDeletionRequestMetadata`); where two routes
 * bind the same name to different verbs the mutating one wins, because treating
 * an ambiguous binding as a read is the direction that loses coverage.
 */
let globalVerbBindings: Map<string, string> | null = null;

function buildGlobalVerbBindings(): Map<string, string> {
  if (globalVerbBindings != null) return globalVerbBindings;

  const bindings = new Map<string, string>();
  const routeFiles = walkFiles(apiRoot).filter((file) => /[/\\]route\.(ts|tsx)$/.test(file));

  for (const routeFile of routeFiles) {
    let content: string;
    try {
      content = readFileSync(routeFile, "utf8");
    } catch {
      continue;
    }
    const pattern = /export const (GET|POST|PUT|PATCH|DELETE)\b[\s\S]*?metadata:\s*(\w+)/g;
    for (const match of content.matchAll(pattern)) {
      const verb = match[1];
      const name = match[2];
      if (!verb || !name) continue;
      const existing = bindings.get(name);
      if (existing == null || SAFE_VERBS.has(existing)) bindings.set(name, verb);
    }
  }

  globalVerbBindings = bindings;
  return bindings;
}

function readVerbBindings(metadataFile: string): Map<string, string> {
  const routeFile = metadataFile.replace(/route\.metadata\.(ts|tsx)$/, "route.$1");
  const bindings = new Map<string, string>();

  let content: string;
  try {
    content = readFileSync(routeFile, "utf8");
  } catch {
    return bindings;
  }

  const exportPattern = /export const (GET|POST|PUT|PATCH|DELETE)\b[\s\S]*?metadata:\s*(\w+)/g;
  for (const match of content.matchAll(exportPattern)) {
    const verb = match[1];
    const metadataName = match[2];
    if (verb && metadataName) bindings.set(metadataName, verb);
  }

  return bindings;
}

function isSensitivePermission(permission: string): boolean {
  return SENSITIVE_PERMISSION_PREFIXES.some(
    (prefix) => permission === prefix || permission.startsWith(prefix),
  );
}

function collectRouteMetadataFiles(): string[] {
  const routeFiles = walkFiles(apiRoot).filter((file) => /[/\\]route\.(ts|tsx)$/.test(file));
  const metadataFiles = new Set<string>();

  for (const routeFile of routeFiles) {
    const coLocated = routeFile.replace(/route\.(ts|tsx)$/, "route.metadata.$1");
    if (existsSync(coLocated)) {
      metadataFiles.add(coLocated);
      continue;
    }

    metadataFiles.add(routeFile);
  }

  for (const packageRoot of packageMetadataRoots) {
    for (const file of walkFiles(packageRoot)) {
      if (!/\.route-metadata\.(ts|tsx)$/.test(file)) continue;
      if (file.includes("dist") || file.includes("node_modules")) continue;
      metadataFiles.add(file);
    }
  }

  return [...metadataFiles];
}

const violations: string[] = [];
let inspectedBlocks = 0;

for (const file of collectRouteMetadataFiles()) {
  const content = readFileSync(file, "utf8");

  // Was `content.includes("routeMetadata")`, which is case-sensitive. Metadata
  // defined in a domain package is written `satisfies RouteMetadata` and never
  // spells the lowercase form, so every one of those files was skipped here even
  // after the scan root was widened to include them -- a second filter quietly
  // undoing the first.
  if (!/permission:\s*["']/.test(content)) {
    continue;
  }

  const verbs = readVerbBindings(file);

  for (const block of parseRouteMetadataBlocks(content)) {
    inspectedBlocks += 1;
    const { permission, audit } = block;

    if (permission == null || audit == null) {
      continue;
    }

    if (!isSensitivePermission(permission)) {
      continue;
    }

    // A read is not an auditable action. When the binding is unknown the block
    // is still checked -- an unreadable route file must not become a way to
    // opt out.
    const verb = verbs.get(block.exportName) ?? buildGlobalVerbBindings().get(block.exportName);
    if (verb != null && SAFE_VERBS.has(verb)) {
      continue;
    }

    if (!ALLOWED_AUDIT_MODES.has(audit)) {
      violations.push(
        `${relative(root, file).replaceAll("\\", "/")} ` +
          `(${block.exportName}: ${permission} requires audit metadata)`,
      );
    }
  }
}

// Vacuity guard. Every check in this programme that silently scanned nothing
// passed while proving nothing, so refuse to report success on an implausibly
// small sample.
if (inspectedBlocks < 400) {
  console.error(
    `\nBlocked CI: only ${inspectedBlocks} metadata blocks inspected — the scan root or ` +
      "the export shape has changed, and this guard is no longer checking anything.\n",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nBlocked CI: sensitive routes must declare audit metadata.\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    '\nSensitive routes must set routeMetadata.audit to "required" or "platform_scope".\n',
  );
  process.exit(1);
}

process.exit(0);
