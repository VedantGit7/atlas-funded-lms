import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const FORBIDDEN_RUNTIME_PATTERNS = [
  /tenant\.slug\s*===\s*["'`]fundedbeyond["'`]/,
  /tenantSlug\s*===\s*["'`]fundedbeyond["'`]/,
  /\bisFundedBeyond\b/,
  /FundedBeyondOnly/,
  /new\s+PrismaClient\s*\(/,
] as const;

const NO_FORK_SCAN_EXEMPT_PREFIXES = [
  "configs/tenants/fundedbeyond/",
  "docs/",
  "tests/",
  "packages/tenant-config/",
  "packages/db/",
] as const;

export type NoForkFinding = {
  file: string;
  line: number;
  pattern: string;
};

function isNoForkScanExemptPath(normalizedPath: string): boolean {
  return NO_FORK_SCAN_EXEMPT_PREFIXES.some((prefix) => normalizedPath.includes(prefix));
}

export function scanSourceForForkViolations(filePath: string, content: string): NoForkFinding[] {
  const normalized = filePath.replaceAll("\\", "/");
  if (isNoForkScanExemptPath(normalized)) {
    return [];
  }

  const findings: NoForkFinding[] = [];
  const lines = content.split("\n");

  for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
    lines.forEach((line, index) => {
      if (!pattern.test(line)) {
        return;
      }

      findings.push({
        file: normalized,
        line: index + 1,
        pattern: pattern.source,
      });
    });
  }

  if (/fundedbeyond|academy\.fundedbeyond\.com/i.test(content)) {
    if (normalized.startsWith("apps/") || normalized.startsWith("packages/")) {
      const lineIndex = lines.findIndex((line) =>
        /fundedbeyond|academy\.fundedbeyond\.com/i.test(line),
      );
      findings.push({
        file: normalized,
        line: lineIndex >= 0 ? lineIndex + 1 : 1,
        pattern: "fundedbeyond_reference_outside_allowed_paths",
      });
    }
  }

  return findings;
}

export function scanFileForForkViolations(filePath: string): NoForkFinding[] {
  const content = readFileSync(resolve(filePath), "utf8");
  return scanSourceForForkViolations(filePath, content);
}

function walkSourceFiles(directory: string): string[] {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const fullPath = join(directory, entry);
      const normalized = fullPath.replaceAll("\\", "/");

      if (
        normalized.includes("/node_modules/") ||
        normalized.includes("/.next/") ||
        normalized.includes("/dist/")
      ) {
        return [];
      }

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        return walkSourceFiles(fullPath);
      }

      return /\.(ts|tsx|js|mjs)$/.test(fullPath) ? [fullPath] : [];
    });
  } catch {
    return [];
  }
}

function isAllowedPath(normalizedPath: string, allowPaths: string[]): boolean {
  return (
    isNoForkScanExemptPath(normalizedPath) ||
    allowPaths.some((prefix) => normalizedPath.includes(prefix.replaceAll("\\", "/")))
  );
}

export function scanRuntimeForFundedBeyondFork(options: {
  roots: string[];
  allowPaths?: string[];
  repoRoot?: string;
}): NoForkFinding[] {
  const repoRoot = options.repoRoot ?? process.cwd();
  const allowPaths = options.allowPaths ?? [];
  const findings: NoForkFinding[] = [];

  for (const root of options.roots) {
    const absoluteRoot = resolve(repoRoot, root);
    for (const file of walkSourceFiles(absoluteRoot)) {
      const relativePath = relative(repoRoot, file).replaceAll("\\", "/");
      if (isAllowedPath(relativePath, allowPaths)) {
        continue;
      }

      const content = readFileSync(file, "utf8");
      findings.push(...scanSourceForForkViolations(relativePath, content));
    }
  }

  return findings;
}
