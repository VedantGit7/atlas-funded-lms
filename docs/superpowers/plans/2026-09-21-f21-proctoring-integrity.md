# F21 proctoring referential integrity implementation plan

**Goal:** implement the user-approved F21 audit fix: prevent orphan and cross-tenant/session media references while preserving retained evidence and object-first cleanup.

**Architecture:** three restrictive foreign keys protect media tenant, tenant/session and optional tenant/session/event references. Supporting unique/index keys keep parent checks efficient. Install foreign keys NOT VALID, then validate existing records in a separate migration. Never repair historical records by deletion. Existing expiry policy and append-only event behavior remain in force.

**Stack:** PostgreSQL, Prisma schema/migrations, Node/pg verification, Vitest integration tests.

- [x] Read local aggregate integrity state and lifecycle code; preserve unrelated work.
- [x] Reproduce missing parent enforcement with a real disposable database regression.
- [x] Add staged constraints, matching Prisma relationships, and read-only integrity checker.
- [x] Replace retention tests' fake session IDs with real session rows; verify retention and proctoring flows on a full disposable schema.
- [x] Obtain independent review, verify schema generation/lint and staged validation failure behavior.
- [x] Apply only verified F21 migrations locally if preflight is clean; document verification and remaining deployment scope, stop disposable services.

Alternatives considered: application-only validation cannot protect direct SQL writes; cascading deletion could strand media objects or remove retained evidence. Restrictive tenant-aware keys match the current retention design. No retention duration or legal policy is invented by this change.
