export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const REPORT_FORMATS = ["csv", "xlsx", "pdf", "json"] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_SCOPES = ["system", "tenant"] as const;

export type ReportScope = (typeof REPORT_SCOPES)[number];

export const REPORT_ROW_CAP = 10_000 as const;
