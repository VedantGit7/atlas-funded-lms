import { createHash } from "node:crypto";

export function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function assertSha256Hex(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("INVALID_SHA256_CHECKSUM");
  }
}

export function assertChecksumMatches(args: {
  expected: string | null | undefined;
  actual: string | null | undefined;
}): void {
  if (!args.expected) return;

  if (!args.actual || args.expected !== args.actual) {
    throw new Error("ASSET_CHECKSUM_MISMATCH");
  }
}
