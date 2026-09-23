# F15 export storage implementation plan

Goal: an export becomes downloadable only after the configured provider stores and verifies the actual bytes; artifact expiry is independent of signed-link expiry; generation is bounded.

Design: stream bounded keyset pages into a private temporary artifact, stream it through the provider interface, read it back while computing SHA-256, and persist a versioned verification manifest with the object key. Use deterministic per-job keys with reconciliation for uncertain remote writes. Downloads require recorded verification, non-expired retention and matching storage metadata, with signed-link lifetime capped by remaining retention. Legacy unverified artifacts require regeneration. Delete bytes before forgetting their references, retaining failed cleanup work for retry. No production migration or data deletion is part of implementation verification.

- [x] Add optional streaming capabilities to the storage interface and implement them in R2/local-fs/local-mock; verify a common provider contract and cancellation/failure behavior (storage agent).
- [x] Replace unbounded export worker materialization with bounded paged generation/private file lifecycle; use provider writes and streamed readback validation; persist verification and separate retention (root).
- [x] Gate all tenant-export download paths on verification and expiry; preserve cancellation/retry and historical response compatibility (root).
- [x] Fix manual/retention cleanup so errors preserve object references and success reflects actual deletion; bound scheduled work and account for inactive tenants (cleanup agent; coordinate schema).
- [x] Run local provider, worker, download, database and broader regression checks; review changes; record R2 live-service limitations and deployment steps. Update audit/runbook/evidence.
