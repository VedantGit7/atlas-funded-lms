import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "apps/web/src/app/api");

const EXEMPT_ROUTE_PATTERNS = [
  /\/health\/route\.ts$/,
  /\/public\//,
  /\/platform\//,
  /\/internal\//,
];

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

function isExempt(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, "/");
  return EXEMPT_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function collectRouteFiles(): string[] {
  return walkFiles(apiRoot).filter((file) => /[/\\]route\.(ts|tsx)$/.test(file));
}

const violations: string[] = [];

for (const routeFile of collectRouteFiles()) {
  if (isExempt(routeFile)) {
    continue;
  }

  const content = readFileSync(routeFile, "utf8");
  const hasZodBoundary =
    /\.parse\(/.test(content) ||
    /\.safeParse\(/.test(content) ||
    /parseJsonBody/.test(content) ||
    /parseRouteParams/.test(content) ||
    /createTenantRoute\s*[<(]/.test(content) ||
    /createPlatformRoute\s*[<(]/.test(content) ||
    (/input:\s*\w+Schema/.test(content) && /output:\s*\w+Schema/.test(content)) ||
    /body:\s*\w+Schema/.test(content);

  if (!hasZodBoundary) {
    violations.push(relative(root, routeFile).replace(/\\/g, "/"));
  }
}

if (violations.length > 0) {
  console.error("\nBlocked CI: API routes must validate request boundaries with Zod.\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

process.exit(0);
