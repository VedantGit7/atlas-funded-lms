import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@atlas/storage/providers/r2-storage-provider", () => ({
  R2StorageProvider: class MockR2StorageProvider {
    readonly mock = true;
  },
}));

import { withPlatformScope, withTenantTx } from "@atlas/db";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { assertTenantKeyPrefix, buildTenantStorageKey } from "@atlas/storage/key-builder";
import { CreateAssetReferenceInputSchema } from "@atlas/storage/schemas/asset-reference";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import {
  confirmAssetUpload,
  createPendingAssetReferenceWithUpload,
  createSignedAssetDownload,
  deleteAssetReference,
} from "@atlas/storage/asset-reference.service";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const uploadInput = {
  purpose: "branding.logo" as const,
  resourceType: "tenant",
  resourceId: null,
  fileName: "logo.png",
  contentType: "image/png",
  sizeBytes: 50_000,
};

function requestWithSpoofedTenantHeaders(spoofedTenantId: string) {
  return new Request(`https://tenant-a.example.com/api/v1/branding`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer token-with-other-tenant-claim",
      "x-tenant-id": spoofedTenantId,
      "x-atlas-tenant-id": spoofedTenantId,
    },
  });
}

type StorageReferenceSeed = {
  assetId: string;
  objectKey: string;
  status: "PENDING_UPLOAD" | "READY" | "DELETED";
};

async function seedStorageReference(args: {
  tenantId: string;
  status: StorageReferenceSeed["status"];
  fileName: string;
}): Promise<StorageReferenceSeed> {
  const assetId = randomUUID();
  const objectKey = buildTenantStorageKey({
    tenantId: args.tenantId,
    purpose: "branding.logo",
    fileName: args.fileName,
  });

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      tenantId: args.tenantId,
      touchedTenantIds: [args.tenantId],
    },
    "Seeding storage reference fixture",
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO storage_references (
          id,
          tenant_id,
          bucket,
          object_key,
          purpose,
          resource_type,
          resource_id,
          file_name,
          content_type,
          size_bytes,
          checksum_sha256,
          visibility,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${assetId}::uuid,
          ${args.tenantId}::uuid,
          'test-bucket',
          ${objectKey},
          'branding.logo',
          'tenant',
          NULL,
          ${args.fileName},
          'image/png',
          1024,
          NULL,
          'private',
          ${args.status},
          now(),
          now()
        )
      `;
    },
  );

  return { assetId, objectKey, status: args.status };
}

describe("storage key prefix isolation", () => {
  it("tenant A creates a key under tenants/{tenantA}/", () => {
    const tenantAId = "11111111-1111-4111-8111-111111111111";
    const key = buildTenantStorageKey({
      tenantId: tenantAId,
      purpose: "branding.logo",
      fileName: "logo-a.png",
    });

    expect(key).toMatch(new RegExp(`^tenants/${tenantAId}/branding/logos/`));
  });

  it("tenant B creates a key under tenants/{tenantB}/", () => {
    const tenantBId = "22222222-2222-4222-8222-222222222222";
    const key = buildTenantStorageKey({
      tenantId: tenantBId,
      purpose: "branding.logo",
      fileName: "logo-b.png",
    });

    expect(key).toMatch(new RegExp(`^tenants/${tenantBId}/branding/logos/`));
  });

  it("rejects tenant B key prefix when scoped to tenant A", () => {
    const tenantAId = "11111111-1111-4111-8111-111111111111";
    const tenantBId = "22222222-2222-4222-8222-222222222222";

    expect(() =>
      assertTenantKeyPrefix({
        tenantId: tenantAId,
        key: `tenants/${tenantBId}/branding/logos/logo.png`,
      }),
    ).toThrow("STORAGE_KEY_TENANT_PREFIX_VIOLATION");
  });
});

describe("host wins over client tenant_id for storage keys", () => {
  it("host wins over token and client tenant headers before storage key generation", async () => {
    const tenantAId = "11111111-1111-4111-8111-111111111111";
    const tenantBId = "22222222-2222-4222-8222-222222222222";

    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          tenant_id: tenantAId,
          tenant_slug: "tenant-a",
          tenant_state: "ACTIVE",
          domain_id: "tenant-a-domain-id",
          domain_status: "ACTIVE",
          hostname: "tenant-a.example.com",
        },
      ]),
    };

    const resolved = await resolveTenantFromRequest({
      req: requestWithSpoofedTenantHeaders(tenantBId),
      db,
    });

    expect(resolved.tenantId).toBe(tenantAId);

    const key = buildTenantStorageKey({
      tenantId: resolved.tenantId,
      purpose: "branding.logo",
      fileName: `tenants/${tenantBId}/spoofed.png`,
    });

    expect(key.startsWith(`tenants/${tenantAId}/`)).toBe(true);
    expect(key.startsWith(`tenants/${tenantBId}/`)).toBe(false);
  });

  it("ignores client-supplied tenant_id in upload metadata when building keys", () => {
    const tenantAId = "11111111-1111-4111-8111-111111111111";
    const tenantBId = "22222222-2222-4222-8222-222222222222";

    const parsed = CreateAssetReferenceInputSchema.parse({
      ...uploadInput,
      tenantId: tenantBId,
      fileName: `tenants/${tenantBId}/logo.png`,
    });

    expect(parsed).not.toHaveProperty("tenantId");

    const key = buildTenantStorageKey({
      tenantId: tenantAId,
      purpose: parsed.purpose,
      fileName: parsed.fileName,
    });

    expect(key.startsWith(`tenants/${tenantAId}/`)).toBe(true);
    expect(key.startsWith(`tenants/${tenantBId}/`)).toBe(false);
  });
});

describeWithDb("storage_references tenant isolation", () => {
  beforeEach(() => {
    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";
  });

  it("tenant A creates a key under tenants/{tenantA}/ in storage_references", async () => {
    const fixture = await createTenantIsolationFixture();
    const provider = new LocalMockStorageProvider();

    const result = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return createPendingAssetReferenceWithUpload(
        tx,
        provider,
        { tenantId: fixture.tenantA.tenantId },
        uploadInput,
      );
    });

    expect(result.data.asset.key).toMatch(
      new RegExp(`^tenants/${fixture.tenantA.tenantId}/branding/logos/`),
    );
  });

  it("tenant B creates a key under tenants/{tenantB}/ in storage_references", async () => {
    const fixture = await createTenantIsolationFixture();
    const provider = new LocalMockStorageProvider();

    const result = await withTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return createPendingAssetReferenceWithUpload(
        tx,
        provider,
        { tenantId: fixture.tenantB.tenantId },
        { ...uploadInput, fileName: "logo-b.png" },
      );
    });

    expect(result.data.asset.key).toMatch(
      new RegExp(`^tenants/${fixture.tenantB.tenantId}/branding/logos/`),
    );
  });

  it("tenant A cannot download tenant B asset reference", async () => {
    const fixture = await createTenantIsolationFixture();
    const tenantBAsset = await seedStorageReference({
      tenantId: fixture.tenantB.tenantId,
      status: "READY",
      fileName: "tenant-b-logo.png",
    });
    const provider = new LocalMockStorageProvider();

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
        return createSignedAssetDownload(
          tx,
          provider,
          { tenantId: fixture.tenantA.tenantId },
          {
            assetReferenceId: tenantBAsset.assetId,
          },
        );
      }),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");
  });

  it("tenant A cannot confirm tenant B asset reference", async () => {
    const fixture = await createTenantIsolationFixture();
    const tenantBAsset = await seedStorageReference({
      tenantId: fixture.tenantB.tenantId,
      status: "PENDING_UPLOAD",
      fileName: "tenant-b-pending.png",
    });
    const provider = new LocalMockStorageProvider();

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
        return confirmAssetUpload(
          tx,
          provider,
          { tenantId: fixture.tenantA.tenantId },
          {
            assetReferenceId: tenantBAsset.assetId,
          },
        );
      }),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");
  });

  it("tenant A cannot soft-delete tenant B asset reference", async () => {
    const fixture = await createTenantIsolationFixture();
    const tenantBAsset = await seedStorageReference({
      tenantId: fixture.tenantB.tenantId,
      status: "READY",
      fileName: "tenant-b-delete.png",
    });
    const provider = new LocalMockStorageProvider();

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
        return deleteAssetReference(
          tx,
          provider,
          { tenantId: fixture.tenantA.tenantId },
          {
            assetReferenceId: tenantBAsset.assetId,
          },
        );
      }),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");

    const tenantBRows = await withTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id::text, status
        FROM storage_references
        WHERE id = ${tenantBAsset.assetId}::uuid
      `;
    });

    expect(tenantBRows).toHaveLength(1);
    expect(tenantBRows[0]?.status).toBe("READY");
  });

  it("RLS blocks cross-tenant storage_references reads", async () => {
    const fixture = await createTenantIsolationFixture();
    const tenantBAsset = await seedStorageReference({
      tenantId: fixture.tenantB.tenantId,
      status: "READY",
      fileName: "tenant-b-rls-read.png",
    });

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM storage_references
        WHERE id = ${tenantBAsset.assetId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it("RLS blocks cross-tenant storage_references updates", async () => {
    const fixture = await createTenantIsolationFixture();
    const tenantBAsset = await seedStorageReference({
      tenantId: fixture.tenantB.tenantId,
      status: "READY",
      fileName: "tenant-b-rls-update.png",
    });

    const updatedCount = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$executeRaw`
        UPDATE storage_references
        SET status = 'DELETED',
            deleted_at = now(),
            updated_at = now()
        WHERE id = ${tenantBAsset.assetId}::uuid
      `;
    });

    expect(Number(updatedCount)).toBe(0);

    const tenantBRows = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantB.tenantId,
        touchedTenantIds: [fixture.tenantB.tenantId],
      },
      "Verifying cross-tenant storage update was blocked",
      async (tx) => {
        return tx.$queryRaw<Array<{ status: string }>>`
          SELECT status
          FROM storage_references
          WHERE id = ${tenantBAsset.assetId}::uuid
        `;
      },
    );

    expect(tenantBRows[0]?.status).toBe("READY");
  });

  it("RLS blocks cross-tenant storage_references inserts", async () => {
    const fixture = await createTenantIsolationFixture();
    const objectKey = buildTenantStorageKey({
      tenantId: fixture.tenantB.tenantId,
      purpose: "branding.logo",
      fileName: "cross-tenant-insert.png",
    });

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
        await tx.$executeRaw`
          INSERT INTO storage_references (
            id,
            tenant_id,
            bucket,
            object_key,
            purpose,
            resource_type,
            resource_id,
            file_name,
            content_type,
            size_bytes,
            checksum_sha256,
            visibility,
            status,
            created_at,
            updated_at
          )
          VALUES (
            ${randomUUID()}::uuid,
            ${fixture.tenantB.tenantId}::uuid,
            'test-bucket',
            ${objectKey},
            'branding.logo',
            'tenant',
            NULL,
            'cross-tenant-insert.png',
            'image/png',
            1024,
            NULL,
            'private',
            'READY',
            now(),
            now()
          )
        `;
      }),
    ).rejects.toThrow();
  });
});
