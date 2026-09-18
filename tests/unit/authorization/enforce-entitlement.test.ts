import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";

const findActiveEntitlementByKeyMock = vi.fn();

vi.mock("@atlas/domain-config", async () => {
  // The gate now reads value_json on every call, so the parse is real here:
  // mocking it would hide whether `{ enabled: false }` actually denies.
  const { parseEntitlementValue } = (await vi.importActual(
    "@atlas/domain-config/schemas/entitlement-value",
  )) as {
    parseEntitlementValue: (raw: unknown) => {
      enabled: boolean;
      limit: number | null;
      period: string;
    };
  };
  return {
    parseEntitlementValue,
    findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
  };
});

import { enforceEntitlement } from "@atlas/authorization";
import { EntitlementRequiredError } from "@atlas/authorization";

const tx = { $queryRaw: vi.fn() } as unknown as TenantTx;

const baseArgs = {
  tenantId: "tenant-a",
  requestId: "req_test",
};

describe("enforceEntitlement", () => {
  beforeEach(() => {
    findActiveEntitlementByKeyMock.mockReset();
  });

  it("returns success when no entitlement key is provided", async () => {
    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: null,
      }),
    ).resolves.toBeUndefined();

    await expect(enforceEntitlement(tx, baseArgs)).resolves.toBeUndefined();

    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
  });

  it("returns success when an active entitlement exists", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue({
      key: "community.enable",
      value: true,
      enabled: true,
      expires_at: null,
    });

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).resolves.toBeUndefined();

    expect(findActiveEntitlementByKeyMock).toHaveBeenCalledWith(tx, "community.enable");
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is missing", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      status: 403,
      entitlementKey: "community.enable",
    });

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toBeInstanceOf(EntitlementRequiredError);
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is expired", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      entitlementKey: "community.enable",
    });
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is disabled", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "gamification.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      entitlementKey: "gamification.enable",
    });
  });

  it("never checks plan_name, plan, or subscription fields", () => {
    const enforceSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/authorization/src/enforce-entitlement.ts",
      ),
      "utf8",
    );
    const repositorySource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/config/src/repositories/entitlement.repository.ts",
      ),
      "utf8",
    );

    // Comments are stripped first. The guarantee is about the code -- that an
    // entitlement is resolved by key and never by joining to a plan or
    // subscription table -- and matching raw source made this fire on prose
    // that merely used the word "plan" while describing that very guarantee.
    // A check that breaks on a comment teaches people to reword comments.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

    for (const source of [enforceSource, repositorySource].map(stripComments)) {
      expect(source).not.toContain("plan_name");
      expect(source).not.toContain("subscription");
      expect(source).not.toMatch(/\bplan\b/i);
    }

    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
  });
});
