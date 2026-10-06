import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import { setStorageProviderForTests } from "@atlas/storage/providers/storage-provider-factory";
import {
  confirmBrandingAssetUpload,
  createBrandingAssetUpload,
} from "@atlas/storage/branding-asset.service";
import {
  confirmAssetUpload,
  createPendingAssetReferenceWithUpload,
} from "@atlas/storage/asset-reference.service";
import { resolveBrandingAssetUrl } from "@atlas/storage/branding-public-url";
import { preloadSvgSanitizer } from "@atlas/storage/svg-sanitize";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * Audit M8 against Postgres: an upload becomes usable only after its bytes
 * match the declared type; SVG is sanitized; branding uploads are finalized.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

suite("upload content verification (audit M8)", () => {
  let fixture: CourseAuthoringFixture;
  const provider = new LocalMockStorageProvider();
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
  const ctx = () => ({
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.adminMembershipId,
    requestId: randomUUID(),
  });

  const upload = async (args: {
    purpose: "branding.logo" | "branding.og-image";
    fileName: string;
    contentType: string;
    body: Buffer;
  }) => {
    const signed = await asAdmin((tx) =>
      createBrandingAssetUpload(tx, ctx(), {
        purpose: args.purpose,
        fileName: args.fileName,
        contentType: args.contentType,
        sizeBytes: args.body.byteLength,
      }),
    );
    // What the browser's signed PUT does.
    await provider.putObject({
      bucket: signed.data.asset.bucket,
      key: signed.data.asset.key,
      body: args.body,
      contentType: args.contentType,
    });
    return signed.data.asset;
  };
  const row = (id: string) =>
    asAdmin(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ status: string; size_bytes: bigint; checksum_sha256: string | null }>
      >`select status, size_bytes, checksum_sha256 from storage_references where id = ${id}::uuid`;
      return rows[0];
    });

  beforeAll(async () => {
    fixture = await createCourseAuthoringFixture();
    setStorageProviderForTests(provider);
    // As the API does at startup: load the sanitizer (jsdom) before any
    // transaction, since a cold load under a busy suite can outlast one.
    await preloadSvgSanitizer();
  }, 120_000);
  afterAll(() => setStorageProviderForTests(null));

  it("finalizes a branding SVG: sanitized, resized, audited, and then resolvable", async () => {
    const evil = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" onload="alert(1)">' +
        '<script>alert(2)</script><rect width="4" height="4" fill="#123"/></svg>',
    );
    const asset = await upload({
      purpose: "branding.logo",
      fileName: "logo.svg",
      contentType: "image/svg+xml",
      body: evil,
    });

    // Not usable until finalized.
    expect(await asAdmin((tx) => resolveBrandingAssetUrl(tx, ctx(), asset.id))).toBeNull();

    const confirmed = await asAdmin((tx) =>
      confirmBrandingAssetUpload(tx, ctx(), { assetReferenceId: asset.id }),
    );
    expect(confirmed.data.asset.status).toBe("READY");
    expect(confirmed.data.url).toEqual(expect.any(String));

    const stored = await provider.getObjectBody({ bucket: asset.bucket, key: asset.key });
    expect(stored?.toString("utf8")).toContain('viewBox="0 0 4 4"');
    expect(stored?.toString("utf8")).not.toMatch(/script|onload/);
    const meta = await provider.headObject({ bucket: asset.bucket, key: asset.key });
    expect(meta?.contentDisposition).toMatch(/^attachment;/);

    const saved = await row(asset.id);
    expect(Number(saved?.size_bytes)).toBe(stored?.byteLength);
    expect(saved?.checksum_sha256).toMatch(/^[a-f0-9]{64}$/);

    const audit = await asAdmin(
      (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
         where tenant_id = ${fixture.tenantId}::uuid and action = 'config.branding.asset_uploaded'
      `,
    );
    expect(audit).toHaveLength(1);
  });

  it("refuses an image whose bytes are an HTML page, and never makes it usable", async () => {
    const asset = await upload({
      purpose: "branding.og-image",
      fileName: "card.png",
      contentType: "image/png",
      body: Buffer.from("<!doctype html><html><script>alert(document.cookie)</script></html>"),
    });

    await expect(
      asAdmin((tx) => confirmBrandingAssetUpload(tx, ctx(), { assetReferenceId: asset.id })),
    ).rejects.toThrow("ASSET_CONTENT_MISMATCH");

    expect((await row(asset.id))?.status).toBe("PENDING_UPLOAD");
    expect(await provider.getObjectBody({ bucket: asset.bucket, key: asset.key })).toBeNull();
    expect(await asAdmin((tx) => resolveBrandingAssetUrl(tx, ctx(), asset.id))).toBeNull();
  });

  it("does not let a ready asset of another purpose stand in as a brand image", async () => {
    const text = Buffer.from("notes\n");
    const pending = await asAdmin((tx) =>
      createPendingAssetReferenceWithUpload(tx, provider, ctx(), {
        purpose: "lesson.attachment",
        resourceType: "lesson",
        resourceId: randomUUID(),
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: text.byteLength,
        visibility: "public-safe",
      }),
    );
    const asset = pending.data.asset;
    await provider.putObject({
      bucket: asset.bucket,
      key: asset.key,
      body: text,
      contentType: "text/plain",
    });
    await asAdmin((tx) => confirmAssetUpload(tx, provider, ctx(), { assetReferenceId: asset.id }));

    expect((await row(asset.id))?.status).toBe("READY");
    expect(await asAdmin((tx) => resolveBrandingAssetUrl(tx, ctx(), asset.id))).toBeNull();
    await expect(
      asAdmin((tx) => confirmBrandingAssetUpload(tx, ctx(), { assetReferenceId: asset.id })),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");
  });
});
