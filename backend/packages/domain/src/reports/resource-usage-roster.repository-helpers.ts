// Shared by the resource usage roster repository files.

export const USAGE_HISTORY_KEYS = [
  "usage.storage_gb",
  "usage.total_learners",
  "usage.products",
  "usage.questions",
  "usage.test_submits",
  "usage.message_sends",
  "usage.email_validations",
] as const;

export const METRIC_LABELS: Record<string, string> = {
  "usage.storage_gb": "Storage",
  "usage.total_learners": "Total learners",
  "usage.products": "Products",
  "usage.questions": "Questions",
  "usage.test_submits": "Tests taken",
  "usage.message_sends": "Message sends",
  "usage.email_validations": "Email validations",
};

export const METRIC_UNITS: Record<string, string> = {
  "usage.storage_gb": "GB",
  "usage.total_learners": "count",
  "usage.products": "count",
  "usage.questions": "count",
  "usage.test_submits": "count",
  "usage.message_sends": "count",
  "usage.email_validations": "count",
};

export function roundGb(value: number): number {
  return Math.round(value * 100) / 100;
}
