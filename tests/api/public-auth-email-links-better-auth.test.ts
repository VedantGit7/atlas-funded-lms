import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.4: the magic-link and confirm routes with Better Auth.
 * The flows themselves run against Postgres in
 * tests/integration/auth/better-auth-email-links.test.ts.
 */

const mocks = vi.hoisted(() => ({
  sendMagicLink: vi.fn(),
  establish: vi.fn(),
  sendAuthEmails: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendMagicLink: (...args: unknown[]) => mocks.sendMagicLink(...args),
  establishSessionFromTokenHash: (...args: unknown[]) => mocks.establish(...args),
}));
vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveRequestTenant: () =>
    Promise.resolve({ tenantId: "018f0000-0000-7000-8000-000000000001", requestId: "r" }),
}));
vi.mock("../../backend/apps/api/src/lib/auth-email", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendAuthEmails: (...args: unknown[]) => mocks.sendAuthEmails(...args),
}));

import { POST as magicLink } from "../../backend/apps/api/src/app/api/v1/public/auth/magic-link/route";
import { POST as confirm } from "../../backend/apps/api/src/app/api/v1/public/auth/confirm/route";

function request(path: string, body: object) {
  return new NextRequest(`http://academy.localhost.test${path}`, {
    method: "POST",
    headers: { host: "academy.localhost.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Better Auth email links through the API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAuthEmails.mockResolvedValue(undefined);
  });

  it("sends the sign-in link Better Auth asked for, with the same answer as always", async () => {
    const link = { kind: "magic-link", email: "a@example.test", token: "t" };
    mocks.sendMagicLink.mockResolvedValue({ ok: true, emails: [link] });

    const response = await magicLink(
      request("/api/v1/public/auth/magic-link", { email: "a@example.test" }),
    );

    expect(await response.json()).toEqual({
      data: {
        ok: true,
        message: "If an account exists for this email, a sign-in link has been sent.",
      },
    });
    expect(mocks.sendAuthEmails).toHaveBeenCalledWith(expect.objectContaining({ emails: [link] }));
  });

  it("answers an approved email change by sending the new address its link", async () => {
    const next = { kind: "verify-new-email", email: "new@example.test", token: "t2" };
    mocks.establish.mockResolvedValue({ status: "email_change_pending", emails: [next] });

    const response = await confirm(
      request("/api/v1/public/auth/confirm", { tokenHash: "t1", type: "email_change" }),
    );

    expect(await response.json()).toEqual({
      data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null },
    });
    expect(mocks.sendAuthEmails).toHaveBeenCalledWith(expect.objectContaining({ emails: [next] }));
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
