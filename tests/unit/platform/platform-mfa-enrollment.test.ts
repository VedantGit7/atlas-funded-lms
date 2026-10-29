import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Platform MFA enrollment. The console requires an aal2 session, and an
 * operator need not belong to a tenant, so the platform has its own enrollment
 * routes. They admit a password-only session only while the operator has no
 * verified factor; nothing else on the platform plane does.
 */

const mocks = vi.hoisted(() => ({
  requireSupabaseUser: vi.fn(),
  upsertAuthPrincipal: vi.fn(),
  findActivePlatformOperator: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/session", () => ({
  requireSupabaseUser: mocks.requireSupabaseUser,
}));
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal: mocks.upsertAuthPrincipal,
}));
vi.mock("../../../backend/packages/auth/src/platform-operators.repository", () => ({
  findActivePlatformOperator: mocks.findActivePlatformOperator,
}));

import { requirePlatformPrincipal } from "../../../backend/packages/auth/src/platform-auth";

const principalId = "018f0000-0000-7000-8000-000000000010";
const db = { $queryRaw: vi.fn() };
const req = new NextRequest("https://platform.example.com/api/v1/platform/me/security/mfa");

function signedIn(args: { mfaEnabled: boolean; aal: "aal1" | "aal2" }) {
  mocks.requireSupabaseUser.mockResolvedValue({
    supabaseUserId: "018f0000-0000-7000-8000-000000000020",
    email: "operator@example.test",
    emailConfirmed: true,
    mfaEnabled: args.mfaEnabled,
    sessionAssuranceLevel: args.aal,
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return String((error as { code?: string }).code);
  }
}

describe("requirePlatformPrincipal with allowMfaEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertAuthPrincipal.mockResolvedValue({ id: principalId });
    mocks.findActivePlatformOperator.mockResolvedValue({
      id: "grant",
      authPrincipalId: principalId,
      roleKey: "support",
      grantedAt: new Date(),
      grantedByPrincipalId: null,
      grantReason: "test",
    });
  });

  const call = (allowMfaEnrollment?: boolean) =>
    requirePlatformPrincipal({
      req,
      db,
      requiredPermission: "platform.tenant.read",
      ...(allowMfaEnrollment === undefined ? {} : { allowMfaEnrollment }),
    });

  it("admits an operator with no verified factor on a password-only session", async () => {
    signedIn({ mfaEnabled: false, aal: "aal1" });
    await expect(call(true)).resolves.toMatchObject({ platformPrincipalId: principalId });
  });

  it("still requires aal2 on every other platform route", async () => {
    signedIn({ mfaEnabled: false, aal: "aal1" });
    expect(await codeOf(call())).toBe("MFA_REQUIRED");
    expect(await codeOf(call(false))).toBe("MFA_REQUIRED");
  });

  it("requires aal2 once a factor is verified, so a stolen password cannot add one", async () => {
    signedIn({ mfaEnabled: true, aal: "aal1" });
    expect(await codeOf(call(true))).toBe("MFA_REQUIRED");
    signedIn({ mfaEnabled: true, aal: "aal2" });
    expect(await codeOf(call(true))).toBe("OK");
  });

  it("denies a non-operator before anything about MFA", async () => {
    mocks.findActivePlatformOperator.mockResolvedValue(null);
    signedIn({ mfaEnabled: false, aal: "aal1" });
    expect(await codeOf(call(true))).toBe("PERMISSION_DENIED");
  });
});

describe("which platform routes may admit a password-only session", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const platformRoutes = join(root, "backend/apps/api/src/app/api/v1/platform");

  function metadataFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return metadataFiles(path);
      return name === "route.metadata.ts" ? [path] : [];
    });
  }

  it("is only the platform MFA enrollment routes", () => {
    const declaring = metadataFiles(platformRoutes)
      .filter((file) => /\bmfa:\s*"/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/"));
    expect(declaring).toEqual([
      "backend/apps/api/src/app/api/v1/platform/me/security/mfa/route.metadata.ts",
    ]);
  });

  it("is wired from route metadata into the principal check", () => {
    const source = readFileSync(
      join(root, "backend/packages/api/src/create-platform-route.ts"),
      "utf8",
    );
    expect(source).toContain('allowMfaEnrollment: config.metadata.mfa === "enrollment"');
  });
});
