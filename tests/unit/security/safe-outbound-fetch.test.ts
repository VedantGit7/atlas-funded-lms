import { describe, expect, it, vi } from "vitest";
import { assertOutboundUrlAllowed, isBlockedAddress } from "@atlas/security/safe-outbound-fetch";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn((hostname: string) =>
    Promise.resolve([
      { address: hostname === "localhost" ? "127.0.0.1" : "93.184.216.34", family: 4 },
    ]),
  ),
}));

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

// Redirect and request behavior now use native transport; regression coverage is
// in outbound-pinning.test.ts and the local socket integration suite.
