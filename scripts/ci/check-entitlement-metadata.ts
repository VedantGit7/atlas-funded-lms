import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "backend/apps/api/src/app/api");

const ENTITLEMENT_OPTIONAL_PERMISSIONS = new Set(["health.read", "tenant.read", "membership.read"]);

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

function parseMetadata(content: string): {
  permission?: string;
  entitlement?: string | null;
  publicRoute?: boolean;
} {
  const entitlementMatch = content.match(/entitlement:\s*(null|["']([^"']+)["'])/);
  let entitlement: string | null | undefined;
  if (entitlementMatch) {
    entitlement = entitlementMatch[1] === "null" ? null : entitlementMatch[2];
  }

  return {
    permission: content.match(/permission:\s*["']([^"']+)["']/)?.[1],
    entitlement,
    publicRoute: /public:\s*true/.test(content),
  };
}

function collectMetadataFiles(): string[] {
  const routeFiles = walkFiles(apiRoot).filter((file) => /[/\\]route\.(ts|tsx)$/.test(file));
  const metadataFiles = new Set<string>();

  for (const routeFile of routeFiles) {
    const coLocated = routeFile.replace(/route\.(ts|tsx)$/, "route.metadata.$1");
    metadataFiles.add(existsSync(coLocated) ? coLocated : routeFile);
  }

  return [...metadataFiles];
}

const violations: string[] = [];

for (const file of collectMetadataFiles()) {
  const content = readFileSync(file, "utf8");
  if (!content.includes("routeMetadata") || content.includes("PlatformRouteMetadata")) {
    continue;
  }

  const metadata = parseMetadata(content);
  if (metadata.publicRoute) {
    continue;
  }

  if (metadata.permission?.startsWith("profile.")) {
    continue;
  }

  if (!metadata.permission) {
    continue;
  }

  if (ENTITLEMENT_OPTIONAL_PERMISSIONS.has(metadata.permission)) {
    continue;
  }

  if (!content.includes("entitlement:")) {
    violations.push(`${relative(root, file).replace(/\\/g, "/")} (missing entitlement field)`);
  }
}

if (violations.length > 0) {
  console.error("\nBlocked CI: tenant routes must declare entitlement metadata (or null).\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

process.exit(0);
