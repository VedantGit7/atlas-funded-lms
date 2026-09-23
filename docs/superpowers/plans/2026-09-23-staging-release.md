# Staging Release Preparation Plan

> **For agentic workers:** Use subagent-driven-development for the independent CI review; root owns candidate review, Git operations, access checks and staging handoff. Preserve all existing remediation changes.

**Goal:** Publish a reviewable F01–F22 release candidate, execute its hosted checks where access permits, and prepare an isolated staging deployment without promoting production.

**Architecture:** Keep the existing Vercel web plus managed Node API/worker topology. Use a dedicated release branch and disposable verification services. Staging requires separate database/auth/storage/provider resources and confirmed hosting access; owning fundedbeyond.com supplies a domain, not compute.

**Tech Stack:** GitHub Actions, Node 24 LTS, pnpm, Next.js, PostgreSQL/Prisma, Supabase Auth, Redis, R2 and Docker.

## Candidate and CI

- [x] Compare the working tree with the 22 September source fingerprint and inspect current main before choosing the release base. Preserve any unrelated changes.
- [x] Review all candidate paths for secrets and local artifacts; inspect audit evidence separately because ordinary source guards do not scan every document.
- [x] Correct the verified Node engine mismatch: pin the supported 24 LTS runtime consistently in `.node-version`, CI, drills and managed-node Docker targets; add engine compatibility regressions and run CI structure checks.
- [x] Validate a frozen dependency install using the selected runtime. Run the required commit checks and affected tests; retain the previous full-suite evidence as historical, not candidate-SHA hosted proof.
- [ ] Create `release/atlas-staging-20260923`, commit the reviewed remediation, reconcile main without discarding changes, and push the candidate to the existing private repository.
- [ ] Open a draft pull request, attach it to this task, inspect hosted CI admission/jobs/artifacts, and fix concrete failures within scope. Never mark missing or rejected CI as passing.

## Staging access and deployment

- [x] Recheck connected Vercel/Supabase/GitHub access and inspect existing deployment configuration. Confirm application hosting and account prerequisites; do not infer a server from a purchased domain.
- [x] Prepare the exact hostname/resource/secret/build/migration/rollout checklist for an isolated staging environment under fundedbeyond.com. Keep production domain routing unchanged.
- [ ] Deploy only after the managed host, isolated providers, credentials and protected ingress exist. Run the existing per-service configuration validators, then matching-release health/auth/tenant/storage/worker checks. Record inaccessible or unprovisioned dependencies explicitly.
- [ ] Save candidate identity, test outcomes, hosted run/PR links and concrete remaining account actions in `docs/engineering/staging-release-preparation-2026-09-23.md` and sanitized evidence under `docs/engineering/audits/2026-09-23/staging`.

No paid subscription, new collaborator grant, production promotion or real-customer workflow is included without the required account decision. The F13/F14/F17/F19 product/security acceptance gaps in the closure matrix remain open until independently satisfied.
