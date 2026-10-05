import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

const { findAssetReferenceByIdMock, createSignedAssetDownloadMock } = vi.hoisted(() => ({
  findAssetReferenceByIdMock: vi.fn(),
  createSignedAssetDownloadMock: vi.fn(),
}));

vi.mock("@atlas/storage/asset-reference.repository", () => ({
  findAssetReferenceById: (...args: unknown[]) => findAssetReferenceByIdMock(...args),
}));

vi.mock("@atlas/storage/asset-reference.service", () => ({
  createSignedAssetDownload: (...args: unknown[]) => createSignedAssetDownloadMock(...args),
}));

import {
  buildPublicSafeAssetUrl,
  resolveBrandingAssetUrl,
} from "@atlas/storage/branding-public-url";

const tx = { $queryRaw: vi.fn() } as never;

describe("buildPublicSafeAssetUrl", () => {
  beforeEach(() => {
    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "atlas-assets";
    process.env.R2_PUBLIC_ENDPOINT = "https://cdn.example.com";
  });

  it("builds CDN URL from bucket and object key", () => {
    expect(
      buildPublicSafeAssetUrl({
        bucket: "atlas-assets",
        object_key: `tenants/${TENANT_ID}/branding/logos/logo.png`,
        purpose: "branding.logo",
      }),
    ).toBe(`https://cdn.example.com/atlas-assets/tenants/${TENANT_ID}/branding/logos/logo.png`);
  });
});

describe("resolveBrandingAssetUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "atlas-assets";
    process.env.R2_PUBLIC_ENDPOINT = "https://cdn.example.com";
  });

  it("returns null when asset reference is missing", async () => {
    await expect(resolveBrandingAssetUrl(tx, { tenantId: TENANT_ID }, null)).resolves.toBeNull();
  });

  it("returns CDN URL for public-safe READY assets", async () => {
    findAssetReferenceByIdMock.mockResolvedValue({
      id: ASSET_ID,
      bucket: "atlas-assets",
      object_key: `tenants/${TENANT_ID}/branding/logos/logo.png`,
      purpose: "branding.logo",
      visibility: "public-safe",
      status: "READY",
    });

    await expect(resolveBrandingAssetUrl(tx, { tenantId: TENANT_ID }, ASSET_ID)).resolves.toBe(
      `https://cdn.example.com/atlas-assets/tenants/${TENANT_ID}/branding/logos/logo.png`,
    );

    expect(createSignedAssetDownloadMock).not.toHaveBeenCalled();
  });

  it("falls back to signed URL when CDN endpoint is unavailable", async () => {
    delete process.env.R2_PUBLIC_ENDPOINT;

    findAssetReferenceByIdMock.mockResolvedValue({
      id: ASSET_ID,
      bucket: "atlas-assets",
      object_key: `tenants/${TENANT_ID}/branding/logos/logo.png`,
      purpose: "branding.logo",
      visibility: "public-safe",
      status: "READY",
    });
    createSignedAssetDownloadMock.mockResolvedValue({
      data: {
        url: "https://signed.example.com/logo.png?expires=1",
        expiresAt: new Date().toISOString(),
      },
    });

    await expect(resolveBrandingAssetUrl(tx, { tenantId: TENANT_ID }, ASSET_ID)).resolves.toBe(
      "https://signed.example.com/logo.png?expires=1",
    );
  });
});
