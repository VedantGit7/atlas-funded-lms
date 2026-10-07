import { describe, expect, it } from "vitest";
import { validateDeploymentConfiguration } from "@atlas/core/config/deployment-contract";
import { redactValue } from "@atlas/observability/redaction";
import { scanManifestForSecrets } from "@atlas/tenant-config/validate";
import type { TenantManifest } from "@atlas/tenant-config";
import { deploymentEnv } from "../../helpers/deployment-env";

/**
 * CodeQL js/polynomial-redos: each input below is the attack string CodeQL
 * reported for a pattern, at a size where the old, backtracking pattern takes
 * seconds. The rewritten checks must stay linear, and still match what they
 * matched before.
 */

const SIZE = 50_000;
const BUDGET_MS = 250;

function timed(run: () => unknown): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe("log redaction", () => {
  it("handles a long run of '?a' after a URL scheme quickly", () => {
    const attack = `http://a?${"a?".repeat(SIZE)}`;
    expect(timed(() => redactValue(attack))).toBeLessThan(BUDGET_MS);
  });

  it("still redacts signed and tokenised URLs, and nothing else", () => {
    expect(redactValue("https://bucket.example/obj?X-Amz-Signature=abc")).toBe("[REDACTED]");
    expect(redactValue("https://api.example/cb?access_token=abc")).toBe("[REDACTED]");
    expect(redactValue("https://example.com/page?ref=home")).toBe(
      "https://example.com/page?ref=home",
    );
  });
});

describe("tenant manifest secret scan", () => {
  const manifest = (value: string) => ({ copy: { tagline: value } }) as unknown as TenantManifest;

  it("handles a long run of 'eyJ' quickly", () => {
    expect(timed(() => scanManifestForSecrets(manifest("eyJ".repeat(SIZE))))).toBeLessThan(
      BUDGET_MS,
    );
  });

  it("still finds a JWT and a storage URL", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
    expect(scanManifestForSecrets(manifest(`token ${jwt}`)).length).toBeGreaterThan(0);
    expect(
      scanManifestForSecrets(manifest("https://acct.r2.cloudflarestorage.com/bucket")).length,
    ).toBeGreaterThan(0);
    expect(
      scanManifestForSecrets(manifest("https://bucket.s3.amazonaws.com/key")).length,
    ).toBeGreaterThan(0);
  });
});

describe("deployment sender address", () => {
  it("rejects a long malformed sender quickly", () => {
    const attack = `!@!.${"!.".repeat(SIZE)}`;
    const elapsed = timed(() => {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), NOTIFICATION_EMAIL_FROM: attack }),
      ).toThrow(/NOTIFICATION_EMAIL_FROM/);
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it.each(["noreply@mail.example.co.uk", "Atlas Academy <noreply@example.com>"])(
    "still accepts %s",
    (sender) => {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), NOTIFICATION_EMAIL_FROM: sender }),
      ).not.toThrow();
    },
  );
});
