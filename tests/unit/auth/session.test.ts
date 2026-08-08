import { describe, expect, it } from "vitest";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_INTERNAL_COOKIE_HEADER,
  extractAccessToken,
  getBearerToken,
  readCookieFromRequest,
} from "@atlas/auth";

describe("session extraction", () => {
  it("reads bearer tokens from Authorization header", () => {
    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        authorization: "Bearer header-access-token",
      },
    });

    expect(getBearerToken(req)).toBe("header-access-token");
  });

  it("prefers bearer token over cookie token", async () => {
    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        authorization: "Bearer header-access-token",
      },
    });

    await expect(extractAccessToken(req)).resolves.toBe("header-access-token");
  });

  it("falls back to access token cookie header", async () => {
    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        cookie: `${ATLAS_ACCESS_TOKEN_COOKIE}=cookie-access-token`,
      },
    });

    await expect(extractAccessToken(req)).resolves.toBe("cookie-access-token");
  });

  it("prefers middleware-refreshed cookies over stale browser cookies", () => {
    const req = new Request("https://tenant-a.example.com/api/v1/workflows", {
      headers: {
        cookie: `${ATLAS_ACCESS_TOKEN_COOKIE}=stale-token`,
        [ATLAS_INTERNAL_COOKIE_HEADER]: `${ATLAS_ACCESS_TOKEN_COOKIE}=refreshed-token`,
      },
    });

    expect(readCookieFromRequest(req, ATLAS_ACCESS_TOKEN_COOKIE)).toBe("refreshed-token");
  });

  it("rejects malformed bearer authorization headers", () => {
    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        authorization: "Token not-bearer",
      },
    });

    expect(getBearerToken(req)).toBeNull();
  });
});
