import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "backend/apps/api/src/app/api");

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

function resolveImportPath(fromFile: string, importPath: string): string | null {
  if (importPath.startsWith("@atlas/domain/")) {
    const subpath = importPath.replace("@atlas/domain/", "");
    return join(root, "packages/domain/src", `${subpath}.ts`);
  }

  if (importPath.startsWith(".")) {
    const base = resolve(dirname(fromFile), importPath);
    const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  return null;
}

function collectImportedMetadataFiles(content: string, filePath: string): string[] {
  const imports = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  const resolved = imports
    .map((importPath) => resolveImportPath(filePath, importPath))
    .filter((path): path is string => path != null);

  return resolved.filter(
    (path) =>
      path.includes("route-metadata") ||
      path.includes(".route-metadata") ||
      path.includes("packages/domain/src/"),
  );
}

function hasPermissionDeclaration(content: string): boolean {
  return /permission:\s*["'][^"']+["']/.test(content);
}

function metadataHasPermission(filePath: string, visited = new Set<string>()): boolean {
  if (visited.has(filePath)) {
    return false;
  }
  visited.add(filePath);

  const content = readFileSync(filePath, "utf8");

  if (/public:\s*true/.test(content)) {
    return true;
  }

  if (hasPermissionDeclaration(content)) {
    return true;
  }

  for (const imported of collectImportedMetadataFiles(content, filePath)) {
    if (metadataHasPermission(imported, visited)) {
      return true;
    }
  }

  return false;
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

  if (!content.includes("routeMetadata")) {
    continue;
  }

  if (/public:\s*true/.test(content)) {
    continue;
  }

  if (!metadataHasPermission(file)) {
    violations.push(relative(root, file).replace(/\\/g, "/"));
  }
}

if (violations.length > 0) {
  console.error("\nBlocked CI: protected routes must declare permission metadata.\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

process.exit(0);
