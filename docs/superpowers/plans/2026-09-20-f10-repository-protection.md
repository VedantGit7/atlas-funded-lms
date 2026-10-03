# F10 repository protection implementation plan

> Execution: inspect live GitHub settings, prepare the administrative configuration, and verify only what the available access can establish. The user requested execution of the audit recommendation. Preserve the accumulated F01–F09 working tree.

**Goal:** Require reviewed pull requests and F09's aggregate CI result for the default/main and release branches, including administrator paths, with force pushes/deletion prohibited and an audited emergency process.

**Architecture:** Add a repository ruleset, retaining existing protection rules. Keep the reviewed desired configuration in `.github/rulesets/atlas-release-protection.json`. Files alone do not enforce GitHub settings: the repository must have an eligible private-repository plan, administrative access, a working hosted aggregate, and an independent eligible code owner before activation can be verified.

**Tech stack:** GitHub REST/rulesets, JSON configuration, existing GitHub Actions aggregate.

- [x] Read the F10 audit requirement and inspect repository, main branch, protection, and ruleset endpoints using the repository owner's connection.
- [x] Identify the plan and connector limitations from fresh responses; preserve sanitized evidence in `docs/engineering/audits/2026-09-20/f10-hosted-status.json`.
- [x] Prepare the active ruleset payload with no bypass actors, one approving code-owner review, stale-review dismissal, last-push approval, conversation resolution, strict `ci-required` from the observed Actions app, and force-push/deletion protection.
- [x] Document the preconditions, import/API application path, effective-rule readback, positive/negative acceptance matrix, and emergency exception procedure in `docs/runbooks/repository-protection.md`.
- [ ] Activate on GitHub and verify effective protection. Blocked by the private-repository plan response, unavailable administrative connector capability, pending F09 hosted run, and unresolved independent code-owner coverage.
- [ ] Demonstrate rejected noncompliant changes for ordinary and administrator identities. Requires the activated ruleset and authenticated test identities; do not attempt destructive probes against main.
- [x] Record final local validation, update the original audit status, and state the remaining activation requirements accurately.

No application code or workflow behavior changes are required in F10. Validate the configuration's structure and alignment with the existing CI job, format the artifacts, and retain results. Do not purchase a plan, change visibility, grant repository access, or fabricate successful enforcement.
