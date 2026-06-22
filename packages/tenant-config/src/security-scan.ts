import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
