# F12 dependency remediation implementation record

**Goal:** resolve the audit's fixable advisories without unrelated framework upgrades or new vulnerability suppressions.

**Approach:** raise direct security patch floors, apply narrow overrides where transitive consumers pin vulnerable versions, preserve the package-manager release-age policy and validate the installed tree.

- [x] Reproduce current advisories from npm and inspect dependency paths.
- [x] Confirm published patches and the availability of a fix for existing `extract-zip` exceptions.
- [x] Update root/storage `adm-zip`, root Vitest and scoped workspace overrides for fflate, qs, baseline-browser-mapping and Hono.
- [x] Review the before/after lockfile delta and install the frozen result with lifecycle scripts disabled.
- [x] Check both configured and unfiltered advisory results.
- [x] Run unit/security/CI and mocked storage tests; retry the single sandbox-blocked CI guard with cache access. Run TypeScript and dependency compatibility checks.
- [x] Update the audit, exception review and remediation report; retain verification artifacts and hashes.

No application behavior was intentionally changed. Existing regression tests verify compatibility of the patched libraries. A hosted rollout remains subject to F11's infrastructure prerequisites.
