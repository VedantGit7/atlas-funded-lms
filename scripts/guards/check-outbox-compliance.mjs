import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

const EXEMPT_FILE_PATTERNS = [
  /route\.metadata\.ts$/,
  /\.route-metadata\.ts$/,
  /\/modules\/.*\.api\.ts$/,
  /posthog-browser\.ts$/,
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

function isExemptFile(normalizedPath, content) {
  if (content.includes('"use client"') || content.includes("'use client'")) {
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

function fileHasApprovedOutboxPath(filePath, content) {
  if (hasOutboxReference(content)) {
    return true;
  }

  const normalized = filePath.replaceAll("\\", "/");

  if (normalized.endsWith("/route.ts") && content.includes("createTenantRoute")) {
    const importedFiles = collectImportedFiles(filePath, content);
    return importedFiles.some((imported) => hasOutboxReference(readFileSync(imported, "utf8")));
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

const failures = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const normalized = file.replaceAll("\\", "/");

  if (isExemptFile(normalized, content)) {
    continue;
  }

  const looksLikeSideEffect = sideEffectTerms.some((term) => content.includes(term));
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
