export const COST_DRIVER_KEYS = [
  "storage_gb_month",
  "active_member",
  "email_sent",
  "custom_domain",
  "api_million_requests",
] as const;

export type CostDriverKey = (typeof COST_DRIVER_KEYS)[number];

export const ALLOCATION_KEYS = [
  "api_requests",
  "active_members",
  "member_days",
  "storage_gb",
  "equal",
] as const;

export type AllocationKey = (typeof ALLOCATION_KEYS)[number];
