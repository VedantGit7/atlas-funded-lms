import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolvePostAuthRedirect,
  resolveSafeRedirectPath,
  termsRequiredDestination,
} from "../../../frontend/apps/web/src/lib/auth/safe-redirect";

describe("resolveSafeRedirectPath", () => {
  it("allows relative in-app paths", () => {
    expect(resolveSafeRedirectPath("/invite/accept?token=abc")).toBe("/invite/accept?token=abc");
    expect(resolveSafeRedirectPath("/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(resolveSafeRedirectPath("https://evil.example/phish")).toBeNull();
    expect(resolveSafeRedirectPath("//evil.example/phish")).toBeNull();
    expect(resolveSafeRedirectPath("")).toBeNull();
  });

  // Security review 5.3, finding 4: browsers and URL parsing read `/\host`
  // as `//host`.
  it("rejects a backslash that would leave the site", () => {
    const backslash = "/\\evil.example/phish";
    expect(new URL(backslash, "https://academy.example").host).toBe("evil.example");
    expect(resolveSafeRedirectPath(backslash)).toBeNull();
  });
});

describe("post-verification redirects (security review 5.3, finding 4)", () => {
  const web = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

  it.each([
    "app/auth/confirm/route.ts",
    "app/verify-email/page.tsx",
    "app/verify-email/_components/VerifyEmailScreen.tsx",
  ])("%s checks its destination with resolveSafeRedirectPath", (file) => {
    const source = readFileSync(resolve(web, file), "utf8");
    expect(source).toContain("resolveSafeRedirectPath(");
    // The old hand-written check stopped `//` but not `/\`.
    expect(source).not.toMatch(/startsWith\("\/\/"\)/);
  });
});

describe("termsRequiredDestination", () => {
  it("sends to the join page, carrying a safe destination on", () => {
    expect(termsRequiredDestination(null)).toBe("/join");
    expect(termsRequiredDestination("/courses/abc")).toBe("/join?next=%2Fcourses%2Fabc");
    // An unsafe destination is dropped, never carried.
    expect(termsRequiredDestination("//evil.example")).toBe("/join");
    expect(termsRequiredDestination("https://evil.example")).toBe("/join");
  });
});

describe("resolvePostAuthRedirect", () => {
  it("prefers client redirect over API redirect", () => {
    expect(resolvePostAuthRedirect("/invite/accept?token=a", "/")).toBe("/invite/accept?token=a");
  });

  it("falls back to API then default", () => {
    expect(resolvePostAuthRedirect(null, "/studio", null)).toBe("/studio");
    expect(resolvePostAuthRedirect(null, null, "/invite/accept")).toBe("/invite/accept");
  });
});
