import { describe, expect, it } from "vitest";
import { assertChecksumMatches, assertSha256Hex, sha256Hex } from "@atlas/storage/checksum";

const VALID_SHA256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("checksum", () => {
  it("accepts valid sha256", () => {
    expect(() => assertSha256Hex(VALID_SHA256)).not.toThrow();
    expect(sha256Hex("hello")).toBe(VALID_SHA256);
  });

  it("rejects invalid checksum", () => {
    expect(() => assertSha256Hex("not-a-checksum")).toThrow("INVALID_SHA256_CHECKSUM");
    expect(() => assertSha256Hex("abc")).toThrow("INVALID_SHA256_CHECKSUM");
    expect(() => assertSha256Hex("G".repeat(64))).toThrow("INVALID_SHA256_CHECKSUM");
  });

  it("rejects mismatch", () => {
    const other = "b".repeat(64);

    expect(() =>
      assertChecksumMatches({
        expected: VALID_SHA256,
        actual: other,
      }),
    ).toThrow("ASSET_CHECKSUM_MISMATCH");

    expect(() =>
      assertChecksumMatches({
        expected: VALID_SHA256,
        actual: null,
      }),
    ).toThrow("ASSET_CHECKSUM_MISMATCH");
  });
});
