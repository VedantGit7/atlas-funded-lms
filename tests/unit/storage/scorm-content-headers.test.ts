import { describe, expect, it } from "vitest";
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

  it("does not leak the tenant URL to hosts the package contacts", () => {
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });
});
