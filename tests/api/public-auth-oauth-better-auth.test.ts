import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.3: the Google sign-in routes. The
 * Google flows themselves run against Postgres in
 * tests/integration/auth/better-auth-google.test.ts.
 */

const mocks = vi.hoisted(() => ({
  startGoogle: vi.fn(),
  completeGoogle: vi.fn(),
  sendAuthEmails: vi.fn(),
  findMembership: vi.fn(),
  ensureLearner: vi.fn(),
  applyReferral: vi.fn(),
  principalRows: vi.fn(),
  buildResponse: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  startGoogleSignIn: (...args: unknown[]) => mocks.startGoogle(...args),
  completeGoogleCallback: (...args: unknown[]) => mocks.completeGoogle(...args),
}));
vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveRequestTenant: () =>
    Promise.resolve({ tenantId: "018f0000-0000-7000-8000-000000000001", requestId: "r" }),
  globalDbPerStatement: { $queryRaw: (...args: unknown[]) => mocks.principalRows(...args) },
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@atlas/membership", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findMembershipByPrincipal: (...args: unknown[]) => mocks.findMembership(...args),
  ensureSelfServiceLearnerMembership: (...args: unknown[]) => mocks.ensureLearner(...args),
}));
vi.mock(
  "../../backend/apps/api/src/server/sales-referrals/sales-referrals.service",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    applyReferralForNewMembership: (...args: unknown[]) => mocks.applyReferral(...args),
  }),
);
vi.mock("@atlas/domain-identity", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildPublicAuthResponse: (...args: unknown[]) => mocks.buildResponse(...args),
}));
vi.mock("../../backend/apps/api/src/lib/auth-email", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendAuthEmails: (...args: unknown[]) => mocks.sendAuthEmails(...args),
}));

import { POST as start } from "../../backend/apps/api/src/app/api/v1/public/auth/oauth/start/route";
import { POST as callback } from "../../backend/apps/api/src/app/api/v1/public/auth/oauth/callback/route";

function request(path: string, body: object, host = "academy.localhost.test") {
  return new NextRequest(`http://${host}${path}`, {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sessionCookie = "atlas_session=token.sig; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax";

describe("POST /api/v1/public/auth/oauth/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startGoogle.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=s1",
      cookies: { setCookies: ["atlas.state=s1.sig; Max-Age=300; Path=/; HttpOnly"] },
    });
  });

  it("returns Google's URL and passes on Better Auth's state cookie", async () => {
    const response = await start(
      request("/api/v1/public/auth/oauth/start", {
        provider: "google",
      }),
    );

    expect(await response.json()).toEqual({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=s1" },
    });
    expect(response.headers.getSetCookie()).toEqual([
      "atlas.state=s1.sig; Max-Age=300; Path=/; HttpOnly",
    ]);
  });

  it("refuses Apple, which is deferred", async () => {
    const response = await start(
      request("/api/v1/public/auth/oauth/start", {
        provider: "apple",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.startGoogle).not.toHaveBeenCalled();
  });

  it("offers no Google sign-in on the platform console", async () => {
    const response = await start(
      request("/api/v1/public/auth/oauth/start", { provider: "google" }, "platform.localhost"),
    );
    expect(response.status).toBe(400);
    expect(mocks.startGoogle).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/public/auth/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAuthEmails.mockResolvedValue(undefined);
    mocks.findMembership.mockResolvedValue({ id: "membership-1", status: "ACTIVE" });
    mocks.principalRows.mockResolvedValue([
      { email_normalized: "learner@example.test", mfa_enabled: false },
    ]);
    mocks.applyReferral.mockResolvedValue(undefined);
    mocks.buildResponse.mockResolvedValue({ data: { status: "AUTHENTICATED", redirectTo: "/" } });
  });

  // Launch plan 5.1 (staging, 6 November 2026): a new person who signed up with
  // Google got an account but no membership, and was turned away.
  it("makes a new person who signs up with Google a learner, as password sign-up does", async () => {
    mocks.completeGoogle.mockResolvedValue({
      kind: "signed_in",
      principalId: "principal-new",
      cookies: { setCookies: [sessionCookie] },
      emails: [],
    });
    mocks.findMembership
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "membership-new", status: "ACTIVE" });
    mocks.ensureLearner.mockResolvedValue({
      membershipId: "membership-new",
      status: "ACTIVE",
      created: true,
    });

    const response = await callback(
      request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.ensureLearner).toHaveBeenCalledWith(
      expect.objectContaining({ authPrincipalId: "principal-new", email: "learner@example.test" }),
    );
    expect(mocks.applyReferral).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refereeMembershipId: "membership-new" }),
    );
    expect(mocks.buildResponse).toHaveBeenCalledWith(
      expect.objectContaining({ membership: { id: "membership-new", status: "ACTIVE" } }),
    );
  });

  it("doesn't sign up an account with an authenticator until it has entered its code", async () => {
    mocks.completeGoogle.mockResolvedValue({
      kind: "signed_in",
      principalId: "principal-mfa",
      cookies: { setCookies: [sessionCookie] },
      emails: [],
    });
    mocks.principalRows.mockResolvedValue([
      { email_normalized: "mfa@example.test", mfa_enabled: true },
    ]);
    mocks.findMembership.mockResolvedValue(null);

    await callback(request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1" }));

    expect(mocks.ensureLearner).not.toHaveBeenCalled();
    expect(mocks.buildResponse).toHaveBeenCalledWith(expect.objectContaining({ membership: null }));
  });

  it("signs in and sets a browser-session cookie when 'keep me signed in' is off", async () => {
    mocks.completeGoogle.mockResolvedValue({
      kind: "signed_in",
      principalId: "principal-1",
      cookies: { setCookies: [sessionCookie] },
      emails: [],
    });

    const response = await callback(
      request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1" }),
    );

    expect(await response.json()).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/" } });
    expect(mocks.findMembership).toHaveBeenCalledWith(
      expect.objectContaining({ authPrincipalId: "principal-1" }),
    );
    const [cookie] = response.headers.getSetCookie();
    expect(cookie).toMatch(/^atlas_session=token\.sig/);
    expect(cookie).not.toMatch(/Max-Age/i);
  });

  it("keeps the cookie's lifetime with 'keep me signed in'", async () => {
    mocks.completeGoogle.mockResolvedValue({
      kind: "signed_in",
      principalId: "principal-1",
      cookies: { setCookies: [sessionCookie] },
      emails: [],
    });

    const response = await callback(
      request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1", rememberMe: true }),
    );
    expect(response.headers.getSetCookie()[0]).toMatch(/Max-Age=2592000/);
  });

  it("sends a person who linked Google back to their security settings", async () => {
    mocks.completeGoogle.mockResolvedValue({
      kind: "linked",
      cookies: { setCookies: [] },
      emails: [],
    });

    const response = await callback(
      request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1" }),
    );
    expect(await response.json()).toEqual({
      data: { status: "AUTHENTICATED", redirectTo: "/profile/security" },
    });
    expect(mocks.findMembership).not.toHaveBeenCalled();
  });

  it("sends any email Better Auth asked for during the callback", async () => {
    const verify = { kind: "verify-email", email: "new@example.test", token: "t" };
    mocks.completeGoogle.mockResolvedValue({
      kind: "linked",
      cookies: { setCookies: [] },
      emails: [verify],
    });

    await callback(request("/api/v1/public/auth/oauth/callback", { code: "c", state: "s1" }));
    expect(mocks.sendAuthEmails).toHaveBeenCalledWith(
      expect.objectContaining({ emails: [verify] }),
    );
  });

  it("refuses a callback without Google's state", async () => {
    const response = await callback(request("/api/v1/public/auth/oauth/callback", { code: "c" }));
    expect(response.status).toBe(400);
    expect(mocks.completeGoogle).not.toHaveBeenCalled();
  });
});
