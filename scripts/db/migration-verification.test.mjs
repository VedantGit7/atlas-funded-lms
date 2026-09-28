import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  classifyChecksum,
  compareCatalogs,
  recoverHistoricalPrefix,
  verificationVerdict,
} from "./migration-verification.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

test("manual and empty ledger markers never become verified checksums", () => {
  for (const marker of ["", "manual-apply", "manual-apply-payment-report-fields"]) {
    assert.equal(classifyChecksum(marker, "SELECT 1;\n").status, "invalid-ledger-checksum");
  }
});

test("matching catalogs cannot approve invalid, missing, duplicate, or unfinished ledger history", () => {
  const good = {
    ledger: [{ finished_at: "2026-09-26", rolled_back_at: null }],
    checks: [{ status: "exact-match" }],
  };
  assert.deepEqual(verificationVerdict([good], { matches: true }), {
    provenanceVerified: true,
    verified: true,
  });
  for (const bad of [
    { ...good, checks: [{ status: "invalid-ledger-checksum" }] },
    {
      ...good,
      checks: [{ status: "content-mismatch", recoveredPrefix: { checksum: "recovered" } }],
    },
    { ...good, ledger: [] },
    { ...good, checks: [] },
    { ...good, ledger: [...good.ledger, ...good.ledger] },
    { ...good, ledger: [{ finished_at: null, rolled_back_at: null }] },
    { ...good, ledger: [{ finished_at: "2026-09-26", rolled_back_at: "2026-09-26" }] },
  ])
    assert.equal(verificationVerdict([bad], { matches: true }).verified, false);
  assert.equal(verificationVerdict([], { matches: true }).verified, false);
  assert.equal(verificationVerdict([good], null).verified, false);
  assert.equal(verificationVerdict([good], { matches: false }).verified, false);
});

test("line ending equivalence is separated from content drift", () => {
  const lf = "SELECT 1;\nSELECT 2;\n";
  assert.equal(classifyChecksum(hash(lf), lf).status, "exact-match");
  assert.equal(classifyChecksum(hash(lf), lf.replaceAll("\n", "\r\n")).status, "line-ending-match");
  assert.equal(classifyChecksum(hash("SELECT 3;\n"), lf).status, "content-mismatch");
});

test("recovers only an exact line-boundary prefix hash without altering source", () => {
  const original = "CREATE TABLE x (id int);\r\n";
  const current = original + "\r\nGRANT SELECT ON x TO atlas_app;\r\n";
  const recovered = recoverHistoricalPrefix(hash(original), current);
  assert.equal(recovered?.checksum, hash(original));
  assert.equal(recovered?.lineEnding, "CRLF");
  assert.equal(recovered?.lines, 1);
  assert.match(recovered?.appendedSql, /GRANT SELECT/);
  assert.equal(recoverHistoricalPrefix(hash("unrelated"), current), null);
});

test("catalog comparison ignores row order but detects policy, grant and definition drift", () => {
  const expected = {
    columns: [{ table: "polls", name: "quiz_mode", type: "boolean", default: "false" }],
    policies: [{ table: "polls", using: "tenant_id = app.current_tenant_id()" }],
    grants: [{ table: "polls", role: "atlas_app", privilege: "SELECT" }],
  };
  assert.equal(compareCatalogs(expected, structuredClone(expected)).matches, true);
  for (const category of Object.keys(expected)) {
    const actual = structuredClone(expected);
    actual[category][0] = { ...actual[category][0], changed: true };
    const diff = compareCatalogs(expected, actual);
    assert.equal(diff.matches, false);
    assert.equal(diff.categories[category].referenceOnly.length, 1);
    assert.equal(diff.categories[category].targetOnly.length, 1);
  }
  assert.equal(compareCatalogs({ indexes: ["b", "a"] }, { indexes: ["a", "b"] }).matches, true);
  assert.equal(compareCatalogs({ tables: ["polls"] }, {}).matches, false);
});
