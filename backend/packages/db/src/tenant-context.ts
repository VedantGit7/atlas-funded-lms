export type TenantRequestContext = {
  tenantId: string;
  requestId: string;

  /**
   * Required for protected tenant routes.
   * Public tenant routes may omit it only when allowAnonymousTenantRead is true.
   */
  actorMembershipId?: string | null;

  /**
   * Only approved public tenant surfaces may use this:
   * - public landing
   * - public diagnostic
   * - public certificate verification
   * - login/signup/invite acceptance where tenant context is needed
   */
  allowAnonymousTenantRead?: boolean;

  /**
   * Optional override for Postgres `statement_timeout` (ms) inside the
   * tenant transaction. Defaults to `tenants.statement_timeout_ms` schema
   * default (5000) when omitted.
   */
  statementTimeoutMs?: number | null;
};
