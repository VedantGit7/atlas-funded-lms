import { createHash } from "node:crypto";

// Reviewed synthetic literals only. Hash the entire matched URL, without URL
// normalization: changing a password, host, port, database or query must fail.
// Path + literal digests avoid duplicating credential-shaped strings in this
// inventory. These entries never exempt a file, directory or another pattern.
// Additions require review of the fixture's target and purpose, not just a hash
// copied from a scanner failure. See check-secrets.test.mjs for CLI regressions.
const approvedDatabaseFixtures = new Map([
  [
    "scripts/db/test-cleanup-boundary.test.mjs",
    new Set([
      // Disposable application/cleanup identities on loopback:15440/atlas_lms_test.
      "a3ebc8860fdc5672dfac6f336af9c0869d5e6687fe89b7e5b632a8edff25358a",
      "69aca1f48214794954cdb1264c559571ad4b3c84dfcf4ea39749622bd6e12334",
      // Synthetic prod/real rejection input; parsed only, never connected.
      "fe247cdf6869419245e88f95b27ea8427a137b8e5fe2075da98d1fe42263d769",
    ]),
  ],
  [
    "scripts/db/verify-proctoring-integrity.mjs",
    new Set([
      // Fresh dedicated PostgreSQL fixture on loopback:15442/atlas_lms_test.
      "f24ccd5ca00c1e91ef0c1a8052c634671f7e12f609b7eeb6986da68651d5e8e5",
    ]),
  ],
  [
    "scripts/db/verify-test-cleanup.mjs",
    new Set([
      // Admin, application and cleanup identities in the disposable F20 fixture.
      "c0cf1f9c9bff2f9f02997465c30d5c8ea36a4909c9b88305b4346f9ed46f0591",
      "ad08a0570b4f4356412bb09386097cce0a1a9f03c8d5a0c202a9d4d951ec8ec5",
      "57d997d55296bb0ec9a6f7329591fe780789f95d4a840a82be8d2e7dedcf3812",
    ]),
  ],
  [
    "scripts/e2e/local-env.mjs",
    new Set([
      // Compose-owned local E2E application database on loopback:15436.
      "bb3418c8b7b426cca9929f9b028c36c6c007a7c0f405c915b974b68b4564d053",
    ]),
  ],
  [
    "scripts/e2e/local-stack.compose.yml",
    new Set([
      // Same disposable Compose stack, private database service and auth DB.
      "c71a802001bc75f6a6db8a0a921c84b53bb8faac11e9600cec102ca56ebdad00",
    ]),
  ],
  [
    "scripts/perf/microbenchmark-guard.test.mjs",
    new Set([
      // Synthetic loopback fixture and prod.example rejection input; no I/O.
      "31cdf905cfc0584a2e0c2c2ec411bfcb184474d92a16ae75209b6131ebeeeb89",
      "7eb891735d0d78f65cd5e9c70747e938cf1473322e2d9bd66ee4e70d6c81141a",
    ]),
  ],
  [
    "scripts/security/verify-f19-event-trigger.mjs",
    new Set([
      // Fixed loopback:15439/atlas_f19_verification target, identity checked.
      "3a0266e784e0b165c8ae5bba16fdd4f07239cfde424422cb8f9f2042dbf68e1f",
    ]),
  ],
]);

export function isApprovedDatabaseFixture(path, literal) {
  const approved = approvedDatabaseFixtures.get(path);
  return approved?.has(createHash("sha256").update(literal).digest("hex")) ?? false;
}
