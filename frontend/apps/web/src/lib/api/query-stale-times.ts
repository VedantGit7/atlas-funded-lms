/**
 * React Query staleTime defaults — see plan/frontend-planning/performance.md §3.2.
 * F8 exit: all hooks should reference these constants (not magic numbers).
 */
export const queryStaleTimes = {
  /** Shell context, /me projection */
  meShell: 30_000,
  /** Notification badge / list preview */
  notifications: 15_000,
  /** Course catalog, learning-path lists */
  catalogList: 60_000,
  /** Admin tables with URL-driven filters */
  adminTable: 30_000,
  /** Assessment runner — mutation-driven; no cache staleness */
  assessmentRunner: 0,
  /** Default for unspecified client queries */
  default: 30_000,
} as const;

export type QueryStaleTimeKey = keyof typeof queryStaleTimes;
