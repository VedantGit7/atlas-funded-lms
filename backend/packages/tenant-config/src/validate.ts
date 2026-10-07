import { FORBIDDEN_MANIFEST_TERMS } from "./catalogue";
import { bandConfigSchema } from "./schema";
import type { TenantManifest } from "./types";
import type { ValidationIssue } from "./types";

const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]+/,
  // A JWT starts at a token boundary; without the lookbehind every "eyJ" in a
  // long run is a fresh start and the scan is quadratic (CodeQL js/polynomial-redos).
  /(?<![a-zA-Z0-9_-])eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  // Host labels cannot contain "." or "/", so the match cannot backtrack.
  /https?:\/\/(?:[^\s"'/.]+\.)*(?:r2\.cloudflarestorage\.com|amazonaws\.com)/i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
] as const;

const ALLOWED_UUID_CONTEXTS = new Set([
  "logoLightStorageRefId",
  "logoDarkStorageRefId",
  "faviconStorageRefId",
]);

function collectJsonStrings(value: unknown, path = ""): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectJsonStrings(entry, `${path}[${String(index)}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectJsonStrings(entry, path ? `${path}.${key}` : key),
    );
  }

  return [];
}

export function validateBandsNonOverlapping(
  bands: Array<{ key: string; minScore: number; maxScore: number; sortOrder: number }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const band of bands) {
    const parsed = bandConfigSchema.safeParse(band);
    if (!parsed.success) {
      issues.push({ path: `scoring.bands.${band.key}`, message: parsed.error.message });
      continue;
    }

    if (band.minScore > band.maxScore) {
      issues.push({
        path: `scoring.bands.${band.key}`,
        message: "minScore must not exceed maxScore.",
      });
    }
  }

  const keys = bands.map((band) => band.key);
  if (new Set(keys).size !== keys.length) {
    issues.push({ path: "scoring.bands", message: "Band keys must be unique." });
  }

  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous && current && previous.maxScore >= current.minScore) {
      issues.push({
        path: "scoring.bands",
        message: `Bands ${previous.key} and ${current.key} overlap.`,
      });
    }
  }

  return issues;
}

/**
 * Legal documents (`tenantConfigJson.legal`) are free-form prose, not
 * configuration. `FORBIDDEN_MANIFEST_TERMS` exists to stop a manifest
 * *declaring* prop-trading capability the LMS does not have — but a Terms
 * document legitimately has to name those things in order to disclaim them
 * ("the Academy does not operate trading accounts"), and a Privacy Policy has
 * to describe payment processing to disclose its sub-processors. Scanning
 * prose for capability keywords flags exactly the sentences that make the
 * boundary explicit.
 *
 * Secret detection still applies here — that is about leaked credentials, not
 * vocabulary, and legal text has no business containing one.
 */
function isLegalProsePath(path: string): boolean {
  return path === "tenantConfigJson.legal" || path.startsWith("tenantConfigJson.legal.");
}

export function scanManifestForSecrets(manifest: TenantManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strings = collectJsonStrings(manifest);

  for (const { path, value } of strings) {
    for (const term of isLegalProsePath(path) ? [] : FORBIDDEN_MANIFEST_TERMS) {
      if (value.toLowerCase().includes(term.toLowerCase())) {
        issues.push({
          path,
          message: `Forbidden manifest term detected: ${term}`,
        });
      }
    }

    for (const pattern of SECRET_PATTERNS) {
      if (!pattern.test(value)) {
        continue;
      }

      const isAllowedUuid =
        pattern.source.includes("0-9a-f") && ALLOWED_UUID_CONTEXTS.has(path.split(".").pop() ?? "");

      if (!isAllowedUuid) {
        issues.push({
          path,
          message: "Potential secret, token, or raw asset reference detected.",
        });
      }
    }
  }

  return issues;
}

export function validateReadinessBandReferences(manifest: TenantManifest): ValidationIssue[] {
  const bandKeys = new Set(manifest.scoring.bands.map((band) => band.key));
  const issues: ValidationIssue[] = [];

  for (const rule of manifest.readiness.ctaPolicy.bandProminenceRules) {
    if (!bandKeys.has(rule.bandKey)) {
      issues.push({
        path: `readiness.ctaPolicy.bandProminenceRules.${rule.bandKey}`,
        message: `Band key ${rule.bandKey} is not defined in scoring.bands.`,
      });
    }
  }

  return issues;
}

export function validateManifestSemantics(manifest: TenantManifest): ValidationIssue[] {
  return [
    ...validateBandsNonOverlapping(manifest.scoring.bands),
    ...scanManifestForSecrets(manifest),
    ...validateReadinessBandReferences(manifest),
  ];
}

export function validateManifest(manifest: TenantManifest): {
  valid: boolean;
  issues: ValidationIssue[];
} {
  const issues = validateManifestSemantics(manifest);
  return { valid: issues.length === 0, issues };
}
