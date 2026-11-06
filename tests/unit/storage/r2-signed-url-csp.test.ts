import { describe, expect, it } from "vitest";
import { R2StorageProvider } from "@atlas/storage/providers/r2-storage-provider";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import * as policy from "../../../configs/security-headers.mjs";

/**
 * Launch plan 5.1 (staging, 6 November 2026): browsers upload straight to R2
 * with a signed URL, and the page CSP must allow that URL's origin. The
 * provider signed URLs on the bucket's own host name while the CSP allows
 * `<account>.r2.cloudflarestorage.com`, so the browser refused every upload.
 * These pin the signed origins to the policy built from the same settings.
 */

const settings = {
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acct0123",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "atlas-assets",
};

const buildDocumentCsp = (
  policy as unknown as {
    buildDocumentCsp: (nonce: string, env: Record<string, string | undefined>) => string;
  }
).buildDocumentCsp;

function sources(csp: string, directive: string): string[] {
  const entry = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directive} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
}

const csp = buildDocumentCsp("abcdefghijklmnopqrstuvwx", {
  NODE_ENV: "production",
  ...settings,
});
const provider = new R2StorageProvider(parseStorageEnv(settings));

describe("signed R2 URLs and the page CSP", () => {
  it("signs uploads on an origin the page may connect to", async () => {
    const signed = await provider.createSignedUploadUrl({
      bucket: settings.R2_BUCKET_NAME,
      key: "t/avatar.png",
      contentType: "image/png",
      sizeBytes: 10,
      expiresInSeconds: 60,
    });
    const url = new URL(signed.url);

    expect(sources(csp, "connect-src")).toContain(url.origin);
    expect(url.pathname).toBe("/atlas-assets/t/avatar.png");
  });

  it("signs downloads on an origin the page may show images from", async () => {
    const signed = await provider.createSignedDownloadUrl({
      bucket: settings.R2_BUCKET_NAME,
      key: "t/avatar.png",
      expiresInSeconds: 60,
    });
    const url = new URL(signed.url);

    expect(sources(csp, "img-src")).toContain(url.origin);
    expect(sources(csp, "connect-src")).toContain(url.origin);
  });
});
