import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.3: the OAuth routes with AUTH_PROVIDER=better-auth. The
 * Google flows themselves run against Postgres in
 * tests/integration/auth/better-auth-google.test.ts.
 */

const mocks = vi.hoisted(() => ({
  startGoogle: vi.fn(),
  completeGoogle: vi.fn(),
  sendAuthEmails: vi.fn(),
  findMembership: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authProvider: () => "better-auth",
  startGoogleSignIn: (...args: unknown[]) => mocks.startGoogle(...args),
  completeGoogleCallback: (...args: unknown[]) => mocks.completeGoogle(...args),
}));
vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveRequestTenant: () =>
    Promise.resolve({ tenantId: "018f0000-0000-7000-8000-000000000001", requestId: "r" }),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@atlas/membership", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findMembershipByPrincipal: (...args: unknown[]) => mocks.findMembership(...args),
}));
vi.mock("@atlas/domain-identity", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildPublicAuthResponse: () =>
    Promise.resolve({ data: { status: "AUTHENTICATED", redirectTo: "/" } }),
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

describe("POST /api/v1/public/auth/oauth/start with Better Auth", () => {
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
        redirectTo: "http://academy.localhost.test/auth/callback",
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
        redirectTo: "http://academy.localhost.test/auth/callback",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.startGoogle).not.toHaveBeenCalled();
  });

  it("offers no Google sign-in on the platform console", async () => {
    const response = await start(
      request(
        "/api/v1/public/auth/oauth/start",
        { provider: "google", redirectTo: "http://platform.localhost/auth/callback" },
        "platform.localhost",
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.startGoogle).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/public/auth/oauth/callback with Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAuthEmails.mockResolvedValue(undefined);
    mocks.findMembership.mockResolvedValue({ id: "membership-1", status: "ACTIVE" });
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
    const response = await callback(
      request("/api/v1/public/auth/oauth/callback", { code: "c", codeVerifier: "v" }),
    );
    expect(response.status).toBe(401);
    expect(mocks.completeGoogle).not.toHaveBeenCalled();
  });
});
