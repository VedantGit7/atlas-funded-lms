import { describe, expect, it } from "vitest";
import {
  resolvePostAuthRedirect,
  resolveSafeRedirectPath,
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
