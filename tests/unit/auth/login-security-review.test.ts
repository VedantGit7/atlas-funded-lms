import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { MemoryRateLimitStore, setRateLimitStore } from "@atlas/api/rate-limit-store";
import {
  betterAuthSessionCookieName,
  readBetterAuthSessionToken,
} from "../../../backend/packages/auth/src/better-auth-runtime";
import { assertSecondFactorComplete } from "../../../backend/packages/auth/src/mfa-enforcement";

/** Security review 5.3 (docs/engineering/login-security-review-2026-11-16.md). */

describe("finding 3: the session cookie the cache trusts", () => {
  const production = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const local = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

  it("reads only the name Better Auth reads", () => {
    expect(betterAuthSessionCookieName(production)).toBe("__Secure-atlas_session");
    expect(betterAuthSessionCookieName(local)).toBe("atlas_session");
  });

  it("ignores a plain atlas_session planted before the secure one on https", () => {
    const header = "atlas_session=planted.sig; __Secure-atlas_session=real.sig";
    expect(readBetterAuthSessionToken(header, production)).toBe("real.sig");
    expect(readBetterAuthSessionToken("atlas_session=planted.sig", production)).toBeNull();
  });

  it("reads the plain name locally, where Better Auth sets no secure cookie", () => {
    expect(readBetterAuthSessionToken("atlas_session=local.sig", local)).toBe("local.sig");
    expect(readBetterAuthSessionToken("__Secure-atlas_session=x.sig", local)).toBeNull();
  });
});

describe("finding 2: a session that hasn't passed the account's second factor", () => {
  it("is refused for an account with an authenticator", () => {
    for (const level of ["aal1", undefined] as const) {
      expect(() =>
        assertSecondFactorComplete({ mfaEnabled: true, sessionAssuranceLevel: level }),
      ).toThrow(expect.objectContaining({ code: "MFA_REQUIRED", status: 403 }) as Error);
    }
  });

  it("reaches only the step-up route and the authenticator list, by their metadata", () => {
    const app = resolve(import.meta.dirname, "../../../backend/apps/api/src/app");
    const declaring = readdirSync(app, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.ts$/.test(file))
      .filter((file) => readFileSync(join(app, file), "utf8").includes('mfa: "challenge"'))
      .map((file) => file.split(sep).join("/"));
    expect(declaring).toEqual(["api/v1/me/security/route.metadata.ts"]);
    const metadata = readFileSync(join(app, "api/v1/me/security/route.metadata.ts"), "utf8");
    expect(metadata.match(/mfa: "challenge"/g)).toHaveLength(2);
    expect(readFileSync(join(app, "api/v1/me/security/mfa/step-up/route.ts"), "utf8")).toContain(
      "securityStepUpMetadata",
    );
    expect(readFileSync(join(app, "api/v1/me/security/mfa/route.ts"), "utf8")).toContain(
      "metadata: securityFactorListMetadata",
    );
  });

  it("is accepted once it has, or when the account has none", () => {
    expect(() =>
      assertSecondFactorComplete({ mfaEnabled: true, sessionAssuranceLevel: "aal2" }),
    ).not.toThrow();
    expect(() =>
      assertSecondFactorComplete({ mfaEnabled: false, sessionAssuranceLevel: "aal1" }),
    ).not.toThrow();
  });
});

describe("finding 5: per-address budgets", () => {
  beforeEach(() => {
    setRateLimitStore(new MemoryRateLimitStore());
  });
  afterEach(() => {
    setRateLimitStore(null);
  });

  async function attempts(kind: Parameters<typeof enforceAddressRateLimit>[0]["kind"], n: number) {
    for (let i = 0; i < n; i += 1) {
      await enforceAddressRateLimit({ kind, email: "Learner@Example.test" });
    }
  }

  it("allows 10 password attempts for an address in 15 minutes, then refuses", async () => {
    await attempts("sign-in", 10);
    await expect(
      enforceAddressRateLimit({ kind: "sign-in", email: "learner@example.test " }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it.each(["signup-link", "sign-in-link", "password-reset"] as const)(
    "sends at most 3 %s emails to an address in 15 minutes",
    async (kind) => {
      await attempts(kind, 3);
      await expect(
        enforceAddressRateLimit({ kind, email: "learner@example.test" }),
      ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
    },
  );

  it("keeps each address and each kind separate", async () => {
    await attempts("signup-link", 3);
    await expect(
      enforceAddressRateLimit({ kind: "signup-link", email: "someone-else@example.test" }),
    ).resolves.toBeUndefined();
    await expect(
      enforceAddressRateLimit({ kind: "password-reset", email: "learner@example.test" }),
    ).resolves.toBeUndefined();
  });
});
