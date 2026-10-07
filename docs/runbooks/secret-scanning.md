# Secret scanning

Two checks run in the required `secret-scan` CI job:

- `pnpm check:secrets` scans the current tree with the repository's own patterns.
- gitleaks 8.30.1 scans **every commit** with its default rules plus `.gitleaks.toml`. A credential deleted in a later commit is still in history and still fails the job.

CI downloads the gitleaks release binary and verifies its SHA-256 before running it. Change the version and checksum together, taking the checksum from the release's `checksums.txt` and confirming it against the downloaded file.

## When the scan fails

The job log shows each finding redacted, with its commit, file, line, rule and fingerprint.

1. **A real credential.** Treat it as leaked from the moment it was pushed, even if the branch is unmerged or the commit was amended away. Rotate or revoke it at the provider first, then remove it from the code and load it from the environment or secret manager. Rewriting history does not un-leak a pushed secret; rotation is the fix. Follow `incident-triage.md` if it was a production credential.
2. **Not a credential** (test fixture, published test vector, hash, synthetic value). Acknowledge that one finding by appending its fingerprint to `.gitleaksignore`, with a comment saying what the value is and why it can never be live. Fingerprints are `<commit>:<path>:<rule>:<line>`, so the same value committed anywhere else still fails.

Prefer not committing secret-shaped fixtures at all: derive test values at runtime or make them obviously synthetic.

## Allowlists versus ignored findings

`.gitleaks.toml` allowlists a whole _shape_ of value, so it is reserved for shapes that can never be a credential: SHA-256 digests in audit evidence JSON, and Supabase local-development JWTs signed with the public demo secret. Do not add a path-only or rule-wide allowlist to silence a finding; it would hide a future real secret of the same kind. Everything else is reviewed one finding at a time in `.gitleaksignore`.

The history was reviewed on 7 October 2026. All 17 findings across 238 commits were fixtures or digests; no live credential had been committed.

## Running locally

From the repository root, with Docker:

```sh
docker run --rm -v "$PWD:/repo" -w /repo -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*' ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f git --config .gitleaks.toml --gitleaks-ignore-path .gitleaksignore --redact --verbose --no-banner --exit-code 1 .
```

The safe-directory setting is only needed because the container user does not own the mounted checkout. A shallow clone scans only the commits it has; fetch full history first.
