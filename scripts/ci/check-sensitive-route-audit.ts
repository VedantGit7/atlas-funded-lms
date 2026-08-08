import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "backend/apps/api/src/app/api");

const SENSITIVE_PERMISSION_PREFIXES = [
  "membership.invite",
  "membership.suspend",
  "membership.remove",
  "role.assign",
  "role.revoke",
  "permission_override.",
  "branding.update",
  "branding.publish",
  "tenancy.domain.manage",
  "course.publish",
  "workflow.",
  "certificate.issue",
  "certificate.revoke",
  "moderation.",
  "data.export",
  "data.delete",
  "platform.",
] as const;

const ALLOWED_AUDIT_MODES = new Set(["required", "platform_scope"]);

function walkFiles(directory: string): string[] {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      return stat.isDirectory() ? walkFiles(fullPath) : [fullPath];
    });
  } catch {
    return [];
  }
}

function parseRouteMetadata(content: string): {
  permission: string | undefined;
  audit: string | undefined;
} {
  const permissionMatch = content.match(/permission:\s*["']([^"']+)["']/);
  const auditMatch = content.match(/audit:\s*["']([^"']+)["']/);

  return {
    permission: permissionMatch?.[1],
    audit: auditMatch?.[1],
  };
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

  return [...metadataFiles];
}

const violations: string[] = [];

for (const file of collectRouteMetadataFiles()) {
  const content = readFileSync(file, "utf8");

  if (!content.includes("routeMetadata")) {
    continue;
  }

  const metadata = parseRouteMetadata(content);
  const permission = metadata.permission;
  const audit = metadata.audit;

  if (permission == null || audit == null) {
    continue;
  }

  if (!isSensitivePermission(permission)) {
    continue;
  }

  if (!ALLOWED_AUDIT_MODES.has(audit)) {
    violations.push(
      `${relative(root, file).replaceAll("\\", "/")} (${permission} requires audit metadata)`,
    );
  }
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
