# F16 browser outcomes implementation plan

The user requested the F16 remediation defined in the audit. Its acceptance criteria are the implementation specification: exercise stateful critical journeys, prove isolation denial across object operations, and demonstrate that broken outcomes fail the checks. Preserve earlier remediation work and use dedicated local/CI fixtures rather than customer data.

## Design

Keep accurately named shell smoke coverage, and add deterministic browser journeys backed by real auth, API and database state. Browser actions exercise the product; independent API/database reads verify persistence and forbidden mutations. Every negative case has an authorized control, a foreign sentinel, explicit denial, and unchanged source state. Required CI journeys fail on missing fixtures/credentials rather than silently skipping. MFA uses real local GoTrue challenges; no production authorization bypasses.

Use an isolated local test database and auth stack, with explicit target validation and generated test fixture metadata. Keep screenshot updates separate from verification. Pin Linux browser/runtime baselines and require existing reviewed baselines for CI comparisons. Add outcome assertion mutation tests which demonstrate rejection of missing persistence, missing denial and wrong results. Keep exact executed coverage and any infrastructure/product blockers visible in the final report.

## Tasks

1. Inspect `tests/browser`, current auth/fixture setup, UI flows and domain payloads. Map concrete enroll/resume/complete, assessment, author/review/publish, role and provisioning operations.
2. Add guarded deterministic fixture/auth helpers in `scripts/e2e` and `tests/browser/helpers`; verify configuration rejection before any DB/auth writes. Prepare an isolated database and local auth runtime; retain fixture IDs for exact assertions.
3. Add outcome journeys alongside accurately named smoke tests. Use real browser actions and reload/persistence checks. Extend login helper for real TOTP assurance when required. Cover keyboard completion and focus transitions.
4. Replace hostname comparison with foreign-object read/update/delete/download denial and persistence checks. Include authorized controls so unrelated failures cannot masquerade as isolation.
5. Update Playwright/CI/registry contracts to require meaningful suites and consistent screenshot baselines. Tests for harness guards and outcome assertion mutation sensitivity must fail on intentionally bad states.
6. Execute new browser scenarios against isolated services, debug genuine failures without weakening assertions, run relevant type/lint/static checks, and independently review evidence. Record passed versus unexecuted scope, screenshots, safety boundaries and remaining limitations in the F16 report/runbook.

No production deploy, hosted auth mutations, customer fixture seeding or application-database migration is part of this verification. New ephemeral test infrastructure may be provisioned to execute the authorized tests.
