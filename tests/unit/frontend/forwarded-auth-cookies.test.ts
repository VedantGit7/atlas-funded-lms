import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ResponseCookies } from "../../../frontend/apps/web/node_modules/next/dist/compiled/@edge-runtime/cookies";
import { parseForwardedSetCookie } from "../../../frontend/apps/web/src/lib/server/apply-set-cookie-headers";

/**
 * The web re-sets the cookies the API's auth routes return. On https Better
 * Auth's session cookie is `__Secure-atlas_session`, which a browser drops
 * unless it carries Secure, and its signed value is URL-encoded once.
 */

// A signed Better Auth value: token, a dot, a base64 HMAC that may hold + / =.
const signedValue = () => `${randomBytes(24).toString("base64url")}.ab+cd/ef${"x".repeat(35)}=`;

function forwardOnce(header: string): string {
  const cookie = parseForwardedSetCookie(header);
  if (!cookie) throw new Error("not parsed");
  const headers = new Headers();
  new ResponseCookies(headers).set(cookie.name, cookie.value, cookie.options);
  const [setCookie] = headers.getSetCookie();
  return setCookie ?? "";
}

describe("forwarding the API's auth cookies to the browser", () => {
  it("keeps Secure and the encoded value of the https session cookie", () => {
    const value = signedValue();
    const fromApi = `__Secure-atlas_session=${encodeURIComponent(value)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`;

    const cookie = parseForwardedSetCookie(fromApi);
    expect(cookie).toEqual({
      name: "__Secure-atlas_session",
      value,
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 },
    });

    const toBrowser = forwardOnce(fromApi);
    expect(toBrowser.split(";")[0]).toBe(`__Secure-atlas_session=${encodeURIComponent(value)}`);
    expect(toBrowser).toMatch(/; Secure(;|$)/);
    expect(toBrowser).toMatch(/; HttpOnly(;|$)/);
  });

  it("keeps the two-factor challenge cookie's own lifetime", () => {
    const fromApi = `__Secure-atlas.two_factor=${encodeURIComponent(signedValue())}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`;
    expect(parseForwardedSetCookie(fromApi)?.options).toMatchObject({ secure: true, maxAge: 600 });
  });

  it("forwards a cleared cookie as cleared", () => {
    const fromApi = "__Secure-atlas_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
    expect(parseForwardedSetCookie(fromApi)).toMatchObject({
      value: "",
      options: { maxAge: 0, secure: true },
    });
  });

  it("leaves a plain http cookie without Secure and always HttpOnly", () => {
    const cookie = parseForwardedSetCookie("atlas_session=abc; Path=/; SameSite=Strict");
    expect(cookie?.options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
    });
  });

  it("uses Expires when there is no Max-Age, and Max-Age when there are both", () => {
    const expires = "Thu, 05 Nov 2026 12:00:00 GMT";
    expect(parseForwardedSetCookie(`a=1; Expires=${expires}`)?.options.expires).toEqual(
      new Date(expires),
    );
    expect(
      parseForwardedSetCookie(`a=1; Expires=${expires}; Max-Age=5`)?.options,
    ).not.toHaveProperty("expires");
  });

  it("ignores a header with no cookie name", () => {
    expect(parseForwardedSetCookie("=oops; Path=/")).toBeNull();
    expect(parseForwardedSetCookie("")).toBeNull();
  });
});
