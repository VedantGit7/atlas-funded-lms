# F14 privacy lifecycle implementation plan

Goal: make access removal and export outcomes truthful and auditable, while checking the existing retention policy rather than inventing one. User authorized the F14 audit remediation and asked us to locate/check the policy ourselves.

Architecture: preserve tenant-scoped membership removal and all existing authorization. Persist a versioned outcome alongside completion, explicitly distinguish removal of access from erasure, and record retained categories and review requirements. Unknown historical outcomes remain unknown. Describe the actual partial export scope in API/artifacts/UI. Do not execute live erasure or delete a shared identity. Retention durations, legal holds, external-provider deletion and backup expiry require evidence from existing policy/configuration; unresolved decisions remain explicit release gaps.

- [x] Inventory tables, tenant/global identities, policy documents and retention jobs (independent inventory agent).
- [x] Add failing outcome/manifest/transaction-boundary tests; implement versioned contracts, nullable persisted outcome migration, atomic completion/audit and serialized processing. Preserve old callers and make unsupported erasure actions fail validation.
- [x] Correct learner/admin request and completion wording; add accurate partial profile-export manifest without silently hiding a failed section (independent UI agent).
- [x] Add tenant-export scope/omission metadata and test actual included fields; distinguish historical records without evidence.
- [x] Verify focused tests, typecheck, lint, migration/guards; independently review the result and document deployment/policy gaps. Do not call F14 fully closed when comprehensive erasure/provider/backup acceptance is not proven.
