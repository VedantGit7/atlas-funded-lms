import { describe, expect, it, vi } from "vitest";
import { sendResponse } from "next/dist/server/send-response";
import { scormContentSecurityHeaders } from "@atlas/storage/scorm-content-headers";

/**
 * Regression tests for audit finding C1.
 *
 * Uploaded SCORM files are served as text/html from the app's own origin — the
 * one holding session cookies. The protection is a per-response CSP sandbox
 * that puts the document in an opaque origin.
 */

describe("scormContentSecurityHeaders", () => {
  const headers = scormContentSecurityHeaders();
  const csp = headers["content-security-policy"] ?? "";

  it("sandboxes the response", () => {
    expect(csp).toMatch(/(^|;\s*)sandbox\b/);
  });

  it("allows scripts so SCORM still runs", () => {
    expect(csp).toContain("allow-scripts");
  });

  // The single most important assertion in this file. `allow-scripts` together
  // with `allow-same-origin` would return the document to the app origin and
  // undo the entire protection.
  it("never grants allow-same-origin", () => {
    expect(csp).not.toContain("allow-same-origin");
  });

  it("sets nosniff so the declared type is honoured", () => {
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("permits same-origin framing without granting sandbox origin access", () => {
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("allow-same-origin");
  });

  it("does not leak the tenant URL to hosts the package contacts", () => {
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });
});

async function sendThroughNext(configHeaders: HeadersInit = {}): Promise<Headers> {
  const outgoing = new Headers(configHeaders);
  // Exercise Next's actual Node response sender without a server, storage or DB.
  // A HEAD request avoids piping a response body into the test double.
  const response = {
    statusCode: 0,
    statusMessage: "",
    getHeader: (name: string) => outgoing.get(name) ?? undefined,
    appendHeader: (name: string, value: string) => outgoing.append(name, value),
    originalResponse: { end: vi.fn() },
  };
  await sendResponse(
    { method: "HEAD" } as Parameters<typeof sendResponse>[0],
    response as unknown as Parameters<typeof sendResponse>[1],
    new Response(null, { headers: scormContentSecurityHeaders() }),
  );
  return outgoing;
}

describe("SCORM headers through the installed Next response sender", () => {
  it("retains the opaque sandbox and same-origin framing when config leaves CSP to the route", async () => {
    const outgoing = await sendThroughNext();
    expect(outgoing.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(outgoing.get("content-security-policy")).toContain(
      "sandbox allow-scripts allow-forms allow-popups",
    );
    expect(outgoing.get("content-security-policy")).not.toContain("allow-same-origin");
  });

  it("shows why global framing and CSP headers must exclude SCORM content", async () => {
    const outgoing = await sendThroughNext({
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    });
    // Next keeps existing config headers rather than overriding them with route
    // headers. Both apps need a SCORM exception; changing this helper alone is
    // insufficient to deliver either the sandbox or SAMEORIGIN to the browser.
    expect(outgoing.get("x-frame-options")).toBe("DENY");
    expect(outgoing.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });
});
