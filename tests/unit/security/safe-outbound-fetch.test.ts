import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOutboundUrlAllowed,
  isBlockedAddress,
  safeOutboundFetch,
} from "@atlas/security/safe-outbound-fetch";

/**
 * Regression tests for audit finding H3.
 *
 * Four surfaces fetch tenant-configured URLs server-side. Validation was
 * `z.url()` — syntax only — so a probe confirmed the schema accepted the cloud
 * metadata address, loopback, RFC1918 and IPv6 loopback.
 *
 * The IPv4-mapped IPv6 cases below are not hypothetical: the first version of
 * this guard matched only the dotted spelling (`::ffff:127.0.0.1`), but WHATWG
 * URL parsing normalises to the hex form (`::ffff:7f00:1`), so
 * `http://[::ffff:127.0.0.1]/` slipped through until the hex form was handled.
 */

describe("assertOutboundUrlAllowed", () => {
  it.each([
    ["http://169.254.169.254/latest/meta-data/", "cloud metadata"],
    ["http://127.0.0.1:5432/", "loopback"],
    ["http://10.0.0.1/admin", "RFC1918 10/8"],
    ["http://172.16.5.4/", "RFC1918 172.16/12"],
    ["http://192.168.1.1/", "RFC1918 192.168/16"],
    ["http://100.64.0.1/", "CGNAT"],
    ["http://0.0.0.0/", "unspecified"],
    ["http://[::1]:6379/", "IPv6 loopback"],
    ["http://[::ffff:127.0.0.1]/", "IPv4-mapped loopback, dotted"],
    ["http://[::ffff:7f00:1]/", "IPv4-mapped loopback, hex"],
    ["http://[::ffff:a00:1]/", "IPv4-mapped 10.0.0.1"],
    ["http://[0:0:0:0:0:ffff:169.254.169.254]/", "IPv4-mapped metadata"],
  ])("blocks %s (%s)", async (url) => {
    await expect(assertOutboundUrlAllowed(url)).rejects.toThrow();
  });

  it.each([
    ["file:///etc/passwd", "file"],
    ["gopher://127.0.0.1:11211/_stats", "gopher"],
    ["ftp://example.com/x", "ftp"],
  ])("blocks non-http protocol %s (%s)", async (url) => {
    await expect(assertOutboundUrlAllowed(url)).rejects.toThrow(/Protocol not allowed/);
  });

  it("blocks a hostname that resolves to loopback", async () => {
    // Checking the hostname string alone is not enough; the resolved address matters.
    await expect(assertOutboundUrlAllowed("http://localhost:3001/health")).rejects.toThrow();
  });

  it("allows a legitimate public https URL", async () => {
    await expect(assertOutboundUrlAllowed("https://example.com/hook")).resolves.toBeInstanceOf(URL);
  });
});

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "169.254.169.254", "10.1.2.3", "192.168.0.5", "172.31.255.255", "::1"])(
    "blocks %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );

  it.each(["93.184.216.34", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"])(
    "allows public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );

  it("refuses anything that is not an IP literal", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("safeOutboundFetch redirect handling (H3)", () => {
  // The address checks above all run *before* the request. A redirect happens
  // after, so a public host the guard approves can 302 to 169.254.169.254 and
  // every one of those checks is bypassed. This is the standard SSRF filter
  // bypass, and the only thing standing against it is `redirect: "manual"`
  // plus the 3xx rejection -- one option and one branch that a refactor could
  // drop without any other test noticing.

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("never asks fetch to follow redirects", async () => {
    const spy = vi.fn(() => Promise.resolve(new Response("ok", { status: 200 })));
    globalThis.fetch = spy as unknown as typeof fetch;

    await safeOutboundFetch("https://example.com/hook", { method: "POST" });

    expect(spy).toHaveBeenCalledTimes(1);
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    expect(init.redirect).toBe("manual");
    // Caller options must survive the guard rather than be replaced by it.
    expect(init.method).toBe("POST");
  });

  it.each([301, 302, 303, 307, 308])("rejects a %i rather than chasing it", async (status) => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(null, { status, headers: { location: "http://169.254.169.254/" } }),
      )) as unknown as typeof fetch;

    await expect(safeOutboundFetch("https://example.com/hook")).rejects.toMatchObject({
      reason: "BLOCKED_REDIRECT",
    });
  });

  it("passes a normal response straight through", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response("body", { status: 200 }))) as unknown as typeof fetch;

    const response = await safeOutboundFetch("https://example.com/hook");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("body");
  });

  it("blocks before it ever calls fetch", async () => {
    // Ordering matters: a guard that validated after dispatch would already
    // have hit the metadata endpoint by the time it objected.
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(safeOutboundFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
