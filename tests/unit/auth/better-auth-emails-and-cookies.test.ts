import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  authEmailLink,
  buildAuthEmail,
  requestOrigin,
} from "../../../backend/apps/api/src/lib/auth-email";
import { hasValidAccessToken } from "../../../frontend/apps/web/src/lib/server/session-refresh";

/** Launch plan task 3.2: the emails Better Auth leaves to us, and the web proxy's session check. */

function apiRequest(headers: Record<string, string>): Request {
  return new Request("http://api.atlas.internal/api/v1/public/auth/signup", { headers });
}

describe("Better Auth email links", () => {
  it.each([
    ["magic-link", "magiclink"],
    ["confirm-email-change", "email_change"],
    ["verify-new-email", "email_change"],
  ] as const)("sends a %s link to the confirm page as type %s", (kind, type) => {
    expect(
      authEmailLink({ kind, email: "a@example.test", token: "t" }, "https://academy.example.com"),
    ).toBe(`https://academy.example.com/auth/confirm?token_hash=t&type=${type}`);
  });

  it("asks the current address to approve an email change, naming the new one", () => {
    const email = buildAuthEmail(
      {
        kind: "confirm-email-change",
        email: "old@example.test",
        token: "t",
        newEmail: "new<x>@example.test",
      },
      { origin: "https://academy.example.com", academyName: "Academy" },
    );
    expect(email.subject).toBe("Approve the new email for your Academy account");
    expect(email.body).toContain("new&lt;x&gt;@example.test");
    expect(email.body).toContain("type=email_change");
  });

  it("sends verification to our confirm page, which signs in as Supabase's link does", () => {
    expect(
      authEmailLink(
        { kind: "verify-email", email: "a@example.test", token: "tok en" },
        "https://academy.example.com",
      ),
    ).toBe("https://academy.example.com/auth/confirm?token_hash=tok+en&type=signup");
  });

  it("sends a reset to the reset page with the single-use token", () => {
    expect(
      authEmailLink(
        { kind: "reset-password", email: "a@example.test", token: "abc" },
        "https://academy.example.com",
      ),
    ).toBe("https://academy.example.com/reset-password?token=abc");
  });

  it("names the academy and escapes it", () => {
    const email = buildAuthEmail(
      { kind: "reset-password", email: "a@example.test", token: "abc" },
      { origin: "https://academy.example.com", academyName: "Tom & Jerry <Academy>" },
    );
    expect(email.subject).toBe("Reset your Tom & Jerry <Academy> password");
    expect(email.body).toContain("Tom &amp; Jerry &lt;Academy&gt;");
    expect(email.body).toContain('href="https://academy.example.com/reset-password?token=abc"');
  });

  it("links back to the host the person is on, with its local port", () => {
    expect(
      requestOrigin(apiRequest({ host: "academy.localhost.test:3000" }), { NODE_ENV: "test" }),
    ).toBe("http://academy.localhost.test:3000");
    expect(
      requestOrigin(apiRequest({ host: "academy.example.com" }), { NODE_ENV: "production" }),
    ).toBe("https://academy.example.com");
  });
});

describe("web proxy session check", () => {
  function page(cookie?: string): NextRequest {
    return new NextRequest("https://academy.example.com/dashboard", {
      headers: cookie ? { cookie } : {},
    });
  }

  it("treats a Better Auth session cookie as signed in; the API's 401 decides the rest", () => {
    expect(hasValidAccessToken(page("atlas_session=opaque.signature"))).toBe(true);
    expect(hasValidAccessToken(page("__Secure-atlas_session=opaque.signature"))).toBe(true);
  });

  it("still needs an unexpired access token without one", () => {
    expect(hasValidAccessToken(page())).toBe(false);
    expect(hasValidAccessToken(page("atlas_access_token=not-a-jwt"))).toBe(false);
  });
});
