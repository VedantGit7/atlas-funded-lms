export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const DELETION_TARGET_TYPES = ["membership"] as const;

export type DeletionTargetType = (typeof DELETION_TARGET_TYPES)[number];

export const EXPORT_SCOPE_VERSION = 1 as const;

export const APPROVED_EXPORT_DOMAINS = ["membership", "profile", "course", "enrollment"] as const;
