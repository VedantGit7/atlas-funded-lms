// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Learning-path certificate settings — minimal stub.
 *
 * Parallels `parseCourseCertificateSettings` in `course-certificate-eligibility.ts`,
 * but for learning paths. Certificates for a completed learning path are gated
 * behind the `CERTIFICATE_LEARNING_PATH` feature flag (see
 * `certificate-feature-flags.ts`), so this reader is intentionally lightweight
 * until path-level issuance is fully built out.
 *
 * Configuration is stored under `learning_paths.metadata_json.tags.studioFeatures`,
 * mirroring the course convention:
 *
 *   {
 *     studioFeatures: {
 *       certificate: true,
 *       certificateTemplateId: "<uuid>",
 *       certificateConfiguration: {
 *         requireAllSteps: true,
 *         completionCriteriaPercent: 100,
 *         validityDays: 365,
 *       },
 *     },
 *   }
 */

export type LearningPathCertificatesSettings = {
  enabled: boolean;
  templateId: string | null;
  /** When true, every step of the path must be completed before issuance. */
  requireAllSteps: boolean;
  completionCriteriaPercent: number | null;
  validityDays: number | null;
};

const FEATURES_TAG_KEY = "studioFeatures";
const ENABLED_TAG_KEY = "certificate";
const TEMPLATE_TAG_KEY = "certificateTemplateId";
const CONFIG_TAG_KEY = "certificateConfiguration";

const DEFAULT_SETTINGS: LearningPathCertificatesSettings = {
  enabled: false,
  templateId: null,
  requireAllSteps: true,
  completionCriteriaPercent: null,
  validityDays: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Parse learning-path certificate settings from a path's metadata tags.
 * Returns safe defaults (disabled) when tags are absent or malformed.
 */
export function parseLearningPathCertificateSettings(
  tags: Record<string, unknown> | null | undefined,
): LearningPathCertificatesSettings {
  const features = asRecord(tags?.[FEATURES_TAG_KEY]);
  if (!features) return { ...DEFAULT_SETTINGS };

  const config = asRecord(features[CONFIG_TAG_KEY]);

  const enabled =
    typeof features[ENABLED_TAG_KEY] === "boolean"
      ? features[ENABLED_TAG_KEY]
      : DEFAULT_SETTINGS.enabled;

  const templateId =
    typeof features[TEMPLATE_TAG_KEY] === "string" && features[TEMPLATE_TAG_KEY].length > 0
      ? features[TEMPLATE_TAG_KEY]
      : DEFAULT_SETTINGS.templateId;

  const requireAllSteps =
    config && typeof config["requireAllSteps"] === "boolean"
      ? config["requireAllSteps"]
      : DEFAULT_SETTINGS.requireAllSteps;

  const completionCriteriaPercent =
    config &&
    typeof config["completionCriteriaPercent"] === "number" &&
    config["completionCriteriaPercent"] >= 0 &&
    config["completionCriteriaPercent"] <= 100
      ? Math.floor(config["completionCriteriaPercent"])
      : DEFAULT_SETTINGS.completionCriteriaPercent;

  const validityDays =
    config &&
    typeof config["validityDays"] === "number" &&
    Number.isInteger(config["validityDays"]) &&
    config["validityDays"] > 0
      ? config["validityDays"]
      : DEFAULT_SETTINGS.validityDays;

  return { enabled, templateId, requireAllSteps, completionCriteriaPercent, validityDays };
}
