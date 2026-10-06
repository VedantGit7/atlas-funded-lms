import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createBrandingAssetUpload } from "@atlas/storage/branding-asset.service";
import { contentDispositionFor } from "@atlas/storage/content-disposition";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";
import { preloadSvgSanitizer, sanitizeSvg } from "@atlas/storage/svg-sanitize";
import { BackfillRefused } from "../../../scripts/data/backfill-connection";
import { backfillStoredSvgAssets } from "../../../scripts/data/svg-asset-backfill";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * Audit M8 backfill against Postgres: SVGs stored before uploads were
 * sanitized are rewritten with their record, deleted references included, and
 * a login that row-level security would blind is refused.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const EVIL = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" onload="alert(1)">' +
    '<script>alert(2)</script><rect width="4" height="4" fill="#123"/></svg>',
);
const sha256 = (body: Buffer) => createHash("sha256").update(body).digest("hex");

suite("stored SVG backfill (audit M8)", () => {
  let fixture: CourseAuthoringFixture;
  const ownerUrl = () => process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);

  /** A reference as an upload before M8 left it: confirmed with the raw bytes. */
  async function legacySvg(
    provider: StorageProvider,
    options: { body?: Buffer; status?: "READY" | "DELETED"; withObject?: boolean } = {},
  ) {
    const body = options.body ?? EVIL;
    const signed = await asAdmin((tx) =>
      createBrandingAssetUpload(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: randomUUID(),
        },
        {
          purpose: "branding.logo",
          fileName: "logo.svg",
          contentType: "image/svg+xml",
          sizeBytes: body.byteLength,
        },
      ),
    );
    const { id, bucket, key } = signed.data.asset;
    if (options.withObject !== false) {
      await provider.putObject({ bucket, key, body, contentType: "image/svg+xml" });
    }
    await asAdmin(
      (tx) => tx.$executeRaw`
        update storage_references
           set status = ${options.status ?? "READY"}, size_bytes = ${body.byteLength},
               checksum_sha256 = ${sha256(body)}
         where id = ${id}::uuid
      `,
    );
    return { id, location: { bucket, key } };
  }
  const record = (id: string) =>
    asAdmin(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ size_bytes: bigint; checksum_sha256: string }>>`
        select size_bytes, checksum_sha256 from storage_references where id = ${id}::uuid
      `;
      return rows[0];
    });
  const run = (provider: StorageProvider, apply: boolean) =>
    backfillStoredSvgAssets({
      databaseUrl: ownerUrl(),
      apply,
      provider,
      tenantIds: [fixture.tenantId],
    });

  beforeAll(async () => {
    await preloadSvgSanitizer();
  }, 120_000);

  it("sanitizes stored SVGs and their records together, deleted ones included, then is a no-op", async () => {
    fixture = await createCourseAuthoringFixture();
    const provider = new LocalMockStorageProvider();
    const ready = await legacySvg(provider);
    const deleted = await legacySvg(provider, { status: "DELETED" });
    const deletedGone = await legacySvg(provider, { status: "DELETED", withObject: false });
    const missing = await legacySvg(provider, { withObject: false });
    const unreadable = await legacySvg(provider, { body: Buffer.from("not an svg at all") });

    const dryRun = await run(provider, false);
    expect(dryRun).toMatchObject({
      scanned: 5,
      toSanitize: [ready.id, deleted.id].sort(),
      missing: [missing.id],
      unreadable: [unreadable.id],
      deletedGone: 1,
      sanitized: 0,
      remaining: 2,
    });
    expect((await provider.getObjectBody(ready.location))?.equals(EVIL)).toBe(true);
    expect(deletedGone.id).toBeTruthy();

    const applied = await run(provider, true);
    expect(applied).toMatchObject({ sanitized: 2, failed: [], changedMeanwhile: [], remaining: 0 });

    const clean = await sanitizeSvg(EVIL);
    for (const { id, location } of [ready, deleted]) {
      const stored = await provider.getObjectBody(location);
      expect(stored?.equals(clean)).toBe(true);
      expect(stored?.toString("utf8")).not.toMatch(/script|onload/);
      expect((await provider.headObject(location))?.contentDisposition).toMatch(/^attachment;/);
      const saved = await record(id);
      expect(saved?.checksum_sha256).toBe(sha256(clean));
      expect(Number(saved?.size_bytes)).toBe(clean.byteLength);
    }

    const again = await run(provider, true);
    expect(again).toMatchObject({ alreadySafe: 2, toSanitize: [], toCorrect: [], remaining: 0 });
  });

  it("corrects the record of an object sanitized by an interrupted run", async () => {
    fixture = await createCourseAuthoringFixture();
    const provider = new LocalMockStorageProvider();
    const ref = await legacySvg(provider);
    const clean = await sanitizeSvg(EVIL);
    // The object was rewritten, then the run stopped before recording it.
    await provider.putObject({
      ...ref.location,
      body: clean,
      contentType: "image/svg+xml",
      contentDisposition: contentDispositionFor("image/svg+xml", "logo.svg"),
    });

    const dryRun = await run(provider, false);
    expect(dryRun).toMatchObject({ toSanitize: [], toCorrect: [ref.id], remaining: 1 });
    const applied = await run(provider, true);
    expect(applied).toMatchObject({ corrected: 1, sanitized: 0, remaining: 0 });
    expect((await record(ref.id))?.checksum_sha256).toBe(sha256(clean));
  });

  it("leaves a reference that changed while it ran, object and record alike", async () => {
    fixture = await createCourseAuthoringFixture();
    const inner = new LocalMockStorageProvider();
    const ref = await legacySvg(inner);
    // Another writer updates the reference after the backfill read it.
    const provider = new Proxy(inner, {
      get(target, property, receiver) {
        if (property === "getObjectBody") {
          return async (location: { bucket: string; key: string }) => {
            await asAdmin(
              (tx) => tx.$executeRaw`
                update storage_references set checksum_sha256 = ${"0".repeat(64)}
                 where id = ${ref.id}::uuid
              `,
            );
            return target.getObjectBody(location);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    const applied = await run(provider, true);
    expect(applied).toMatchObject({ changedMeanwhile: [ref.id], sanitized: 0, remaining: 1 });
    expect((await inner.getObjectBody(ref.location))?.equals(EVIL)).toBe(true);
  });

  it("refuses a login that row-level security would hide references from", async () => {
    const role = `m8_backfill_${randomUUID().slice(0, 8)}`;
    const admin = new Client({ connectionString: ownerUrl() });
    await admin.connect();
    try {
      await admin.query(`create role ${role} login password 'm8-backfill-probe'`);
      await admin.query(`grant select, update on storage_references to ${role}`);
      const url = new URL(ownerUrl() ?? "");
      url.username = role;
      url.password = "m8-backfill-probe";
      await expect(
        backfillStoredSvgAssets({
          databaseUrl: url.toString(),
          apply: false,
          provider: new LocalMockStorageProvider(),
        }),
      ).rejects.toBeInstanceOf(BackfillRefused);
    } finally {
      await admin.query(`revoke all on storage_references from ${role}`);
      await admin.query(`drop role if exists ${role}`);
      await admin.end();
    }
  });

  it("refuses a tenant argument that is not a tenant id", async () => {
    await expect(
      backfillStoredSvgAssets({
        databaseUrl: ownerUrl(),
        apply: false,
        provider: new LocalMockStorageProvider(),
        tenantIds: ["--apply"],
      }),
    ).rejects.toThrow(/--tenant expects a tenant id/);
  });
});
