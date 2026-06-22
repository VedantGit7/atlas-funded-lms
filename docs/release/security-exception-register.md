# Security Exception / Risk Register

| ID  | Area | Risk                                 | Mitigation | Owner | Expiry | Status |
| --- | ---- | ------------------------------------ | ---------- | ----- | ------ | ------ |
| —   | —    | No open exceptions at story delivery | —          | —     | —      | —      |

## Rules

- P0 security or isolation exceptions block `READY_FOR_STAGING`.
- Document any waiver with owner, expiry, and compensating controls.
- Never waive RLS, `withTenantTx`, `can()`, or platform scope requirements.

## Review cadence

Review at each release candidate and before CTO production sign-off.
