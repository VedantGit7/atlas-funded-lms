import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import * as policy from "../../../configs/security-headers.mjs";
import { config, proxy } from "../../../frontend/apps/web/src/proxy";
import { ThemeInitScript } from "../../../frontend/apps/web/src/components/ThemeInitScript";

const session = vi.hoisted(() => ({ valid: true, refreshed: false }));
vi.mock("../../../frontend/apps/web/src/lib/server/session-refresh", () => ({
  hasValidAccessToken: () => session.valid,
  tryRefreshSessionForProxy: async () => (session.refreshed ? new Response() : null),
  mergeRequestCookieHeader: () => "atlas=refreshed",
  forwardRefreshedSessionCookies: vi.fn(),
}));

const nonce = "abcdefghijklmnopqrstuvwx";
const build = (
  value = nonce,
  env: Record<string, string | undefined> = { NODE_ENV: "production" },
) =>
  (
    policy as unknown as {
      buildDocumentCsp: (nonce: string, env: Record<string, string | undefined>) => string;
    }
  ).buildDocumentCsp(value, env);

afterEach(() => {
  vi.unstubAllEnvs();
  session.valid = true;
  session.refreshed = false;
});

describe("F13 document CSP", () => {
  it("keeps immutable font assets outside session handling while protecting application routes", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    expect(matches("/fonts/cormorant-garamond/v21/normal-latin.5d618c462b7a.woff2")).toBe(false);
    for (const path of [
      "plus-jakarta-sans/v12",
      "jetbrains-mono/v24",
      "inter/v20",
      "playfair-display/v40",
    ]) {
      expect(matches(`/fonts/${path}/normal-latin.woff2`)).toBe(false);
      expect(matches(`/fonts/${path}-other`)).toBe(true);
    }
    for (const url of [
      "/admin",
      "/platform",
      "/api/v1/fonts",
      "/fonts/cormorant-garamond/v21-other",
    ]) {
      expect(matches(url)).toBe(true);
    }
  });

  it("rejects a mistyped enforcement switch instead of silently disabling protection", () => {
    expect(() => build(nonce, { CSP_ENFORCE: "true" })).toThrow("CSP_ENFORCE");
  });

  it("allows PostHog configuration fetches from its explicit asset origin", () => {
    const csp = build(nonce, { NEXT_PUBLIC_POSTHOG_KEY: "test" });
    expect(csp.split(";").find((part) => part.trim().startsWith("connect-src"))).toContain(
      "https://eu-assets.i.posthog.com",
    );
  });

  it("allows framing only the exact embedded form route", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    for (const path of ["/f/token", "/f/token/", "/f/token/other", "/admin"]) {
      const response = await proxy(new NextRequest(`https://tenant.example.com${path}`));
      expect(response.headers.get("content-security-policy")).toContain(
        `frame-ancestors '${path === "/f/token" || path === "/f/token/" ? "self" : "none"}'`,
      );
    }
    expect(policy.formFramingHeadersRule.source).toBe("/f/:token");
    expect(policy.scormFramingHeadersRule.headers[0]?.value).toBe("SAMEORIGIN");
  });

  it("uses a nonce and explicit providers without broad HTTPS or production script exceptions", () => {
    const csp = build();
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' https://checkout.razorpay.com`);
    expect(csp).not.toMatch(/(?:^|\s)https:(?:;|\s)/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp.split(";").find((part) => part.trim().startsWith("script-src"))).not.toContain(
      "'unsafe-inline'",
    );
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://www.youtube.com https://player.vimeo.com");
    expect(csp).toContain("report-uri /api/v1/public/security/csp-report");
  });

  it("derives exact configured provider origins without leaking Sentry keys or URL paths", () => {
    const csp = build(nonce, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SENTRY_DSN: "https://public-key@o123.ingest.sentry.io/42",
      NEXT_PUBLIC_POSTHOG_KEY: "public-project-key",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      R2_ACCOUNT_ID: "account123",
      R2_PUBLIC_ENDPOINT: "https://assets.example.com",
      CSP_FRAME_ORIGINS: "https://video.example.com",
    });
    for (const origin of [
      "https://project.supabase.co",
      "wss://project.supabase.co",
      "https://o123.ingest.sentry.io",
      "https://eu.i.posthog.com",
      "https://account123.r2.cloudflarestorage.com",
      "https://assets.example.com",
      "https://video.example.com",
    ])
      expect(csp).toContain(origin);
    expect(csp).not.toContain("public-key");
    expect(csp).not.toContain("/42");
  });

  it.each([
    "https:",
    "*",
    "https://*.example.com",
    "http://example.com",
    "https://u:p@example.com",
    "https://example.com/path",
    "https://example.com?x=y",
    "https://example.com;script-src",
    "'unsafe-inline'",
  ])("rejects unsafe configured source %s", (source) => {
    expect(() => build(nonce, { NODE_ENV: "production", CSP_SCRIPT_ORIGINS: source })).toThrow(
      "CSP_SCRIPT_ORIGINS",
    );
  });

  it.each(["", "x'; script-src *", "x\r\ny", "short"])("rejects invalid nonces", (value) => {
    expect(() => build(value)).toThrow("nonce");
  });

  it("permits development eval/WebSockets only outside deployed environments", () => {
    expect(build(nonce, { NODE_ENV: "development" })).toContain("'unsafe-eval'");
    expect(build(nonce, { NODE_ENV: "development" })).not.toContain("upgrade-insecure-requests");
    expect(build(nonce, { NODE_ENV: "development", APP_ENV: "staging" })).not.toContain(
      "'unsafe-eval'",
    );
    expect(build(nonce, { NODE_ENV: "development", VERCEL: "1" })).not.toContain("'unsafe-eval'");
  });

  it("provides only baseline headers statically, leaving nonce/SCORM policies to their owners", () => {
    expect(
      policy.securityHeaders.some((header) => /content-security-policy/i.test(header.key)),
    ).toBe(false);
    expect(
      policy.securityHeaders.find((header) => header.key === "Permissions-Policy")?.value,
    ).toContain("camera=(self), microphone=(self)");
  });

  it("propagates fresh nonces to renderer and enforced response, replacing client headers", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    const makeRequest = () =>
      new NextRequest("https://tenant.example.com/login", {
        headers: {
          host: "tenant.example.com",
          "x-nonce": "attacker",
          "content-security-policy": "script-src *",
          "content-security-policy-report-only": "script-src *",
        },
      });
    const first = await proxy(makeRequest());
    const second = await proxy(makeRequest());
    const firstNonce = first.headers.get("x-middleware-request-x-nonce");
    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]{24,}={0,2}$/);
    expect(firstNonce).not.toBe(second.headers.get("x-middleware-request-x-nonce"));
    expect(first.headers.get("content-security-policy")).toContain(`'nonce-${firstNonce}'`);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(
      first.headers.get("content-security-policy"),
    );
    expect(
      first.headers.get("x-middleware-request-content-security-policy-report-only"),
    ).toBeNull();
    expect(first.headers.get("content-security-policy-report-only")).toBeNull();
    expect(first.headers.get("cache-control")).toContain("no-store");
  });

  it("retains explicit report-only rollout while still giving Next its rendering nonce", async () => {
    vi.stubEnv("CSP_ENFORCE", "0");
    const response = await proxy(
      new NextRequest("https://tenant.example.com/login", {
        headers: { host: "tenant.example.com" },
      }),
    );
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("content-security-policy-report-only")).toContain("'nonce-");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(
      response.headers.get("content-security-policy-report-only"),
    );
  });

  it("keeps policy and no-store on protected redirects", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    session.valid = false;
    const response = await proxy(new NextRequest("https://tenant.example.com/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=");
    expect(response.headers.get("content-security-policy")).toContain("'nonce-");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps rendering nonce and refreshed cookies on the protected refresh path", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    session.valid = false;
    session.refreshed = true;
    const response = await proxy(new NextRequest("https://tenant.example.com/admin"));
    const value = response.headers.get("x-middleware-request-x-nonce");
    expect(response.headers.get("content-security-policy")).toContain(`'nonce-${value}'`);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(
      response.headers.get("content-security-policy"),
    );
    expect(response.headers.get("x-middleware-request-cookie")).toBe("atlas=refreshed");
  });

  it("does not attach the web document policy to API/SCORM rewrites", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/v1/modules/test/scorm-content", {
        headers: {
          host: "localhost",
          "x-nonce": "forged",
          "content-security-policy": "script-src *",
        },
      }),
    );
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBeNull();
  });

  it("marks only the trusted theme initializer with the server nonce", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeInitScript, { tenantModeDefault: "system", nonce } as Parameters<
        typeof ThemeInitScript
      >[0]),
    );
    expect(html).toContain(`nonce="${nonce}"`);
  });
});
