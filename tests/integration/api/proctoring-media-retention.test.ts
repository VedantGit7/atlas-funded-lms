import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  DEFAULT_MEDIA_RETENTION_DAYS,
  MAX_MEDIA_RETENTION_DAYS,
  clampRetentionDays,
  insertProctoringMediaArtifact,
  listExpiredProctoringMedia,
  purgeExpiredProctoringMedia,
  resolveMediaRetentionDays,
} from "../../../backend/apps/api/src/server/proctoring/proctoring-media-retention";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Audit finding M12 — retention policy for proctoring media.
 *
 * The column existed; nothing set it, read it or acted on it. The artifacts are
 * webcam and screen recordings of learners sitting exams, so indefinite
 * retention is a regulatory exposure rather than only a storage bill.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

// proctoring_media_artifacts declares no foreign keys, so these need only a
// stable identifier rather than a full session, attempt and membership chain.
function seedSession(_tenantId: string): Promise<string> {
  return Promise.resolve(randomUUID());
}

describeWithDb("proctoring media retention (M12)", () => {
  it("clamps a tenant's configured window", () => {
    expect(clampRetentionDays(undefined)).toBe(DEFAULT_MEDIA_RETENTION_DAYS);
    expect(clampRetentionDays(30)).toBe(30);
    expect(clampRetentionDays(0)).toBe(1);
    // Tenants may shorten retention freely; extending it past the cap is a
    // decision with regulatory consequences that a settings field should not
    // make on its own.
    expect(clampRetentionDays(10_000)).toBe(MAX_MEDIA_RETENTION_DAYS);
    expect(clampRetentionDays("forever")).toBe(DEFAULT_MEDIA_RETENTION_DAYS);
  });

  it("gives every artifact an expiry", async () => {
    const fixture = await createTenantIsolationFixture();
    const sessionId = await seedSession(fixture.tenantA.tenantId);

    const artifact = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      insertProctoringMediaArtifact(tx, {
        tenantId: fixture.tenantA.tenantId,
        proctoringSessionId: sessionId,
        kind: "webcam",
        objectKey: `proctoring/${sessionId}/webcam.webm`,
        contentType: "video/webm",
      }),
    );

    const daysOut = (artifact.retentionExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(DEFAULT_MEDIA_RETENTION_DAYS - 1);
    expect(daysOut).toBeLessThan(DEFAULT_MEDIA_RETENTION_DAYS + 1);
  });

  it("refuses to store an artifact with no expiry at all", async () => {
    // The column default is the backstop for an upload path that forgets. Prove
    // it holds, because the whole finding is that omission produced immortal
    // footage.
    const fixture = await createTenantIsolationFixture();
    const sessionId = await seedSession(fixture.tenantA.tenantId);

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      await tx.$executeRaw`
        INSERT INTO proctoring_media_artifacts (
          id, tenant_id, proctoring_session_id, kind, r2_object_key, content_type
        )
        VALUES (
          gen_random_uuid(), ${fixture.tenantA.tenantId}::uuid, ${sessionId}::uuid,
          'screen', ${`proctoring/${sessionId}/raw.webm`}, 'video/webm'
        )
      `;
      return tx.$queryRaw<Array<{ retention_expires_at: Date | null }>>`
        SELECT retention_expires_at
          FROM proctoring_media_artifacts
         WHERE proctoring_session_id = ${sessionId}::uuid
      `;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.retention_expires_at).not.toBeNull();
  });

  it("honours a shorter tenant-configured window", async () => {
    const fixture = await createTenantIsolationFixture();

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      await tx.$executeRaw`
        INSERT INTO exam_security_policies (id, tenant_id, key, config_json, created_at, updated_at)
        VALUES (
          gen_random_uuid(), ${fixture.tenantA.tenantId}::uuid, 'default',
          ${JSON.stringify({ mediaRetentionDays: 7 })}::jsonb, now(), now()
        )
      `;
    });

    const days = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      resolveMediaRetentionDays(tx),
    );
    expect(days).toBe(7);
  });

  it("deletes the object before the row, and keeps the row when that fails", async () => {
    const fixture = await createTenantIsolationFixture();
    const sessionId = await seedSession(fixture.tenantA.tenantId);
    const objectKey = `proctoring/${sessionId}/expired.webm`;

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      await insertProctoringMediaArtifact(tx, {
        tenantId: fixture.tenantA.tenantId,
        proctoringSessionId: sessionId,
        kind: "webcam",
        objectKey,
        contentType: "video/webm",
      });
      await tx.$executeRaw`
        UPDATE proctoring_media_artifacts
           SET retention_expires_at = now() - interval '1 day'
         WHERE proctoring_session_id = ${sessionId}::uuid
      `;
    });

    // Storage deletion fails: the row must survive so the next sweep retries.
    // Dropping it here would strand the recording in object storage forever,
    // which is the outcome the finding is about.
    const failedRun = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      purgeExpiredProctoringMedia(tx, () => Promise.reject(new Error("storage down"))),
    );
    expect(failedRun).toEqual({ deleted: 0, failed: 1 });

    const stillThere = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      listExpiredProctoringMedia(tx, 10),
    );
    expect(stillThere.map((a) => a.objectKey)).toContain(objectKey);

    // Storage deletion succeeds: object first, then the row.
    const deletedKeys: string[] = [];
    const goodRun = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      purgeExpiredProctoringMedia(tx, (key) => {
        deletedKeys.push(key);
        return Promise.resolve();
      }),
    );
    expect(deletedKeys).toContain(objectKey);
    expect(goodRun.deleted).toBeGreaterThanOrEqual(1);

    const remaining = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      listExpiredProctoringMedia(tx, 10),
    );
    expect(remaining.map((a) => a.objectKey)).not.toContain(objectKey);
  });

  it("leaves unexpired artifacts alone", async () => {
    const fixture = await createTenantIsolationFixture();
    const sessionId = await seedSession(fixture.tenantA.tenantId);

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      insertProctoringMediaArtifact(tx, {
        tenantId: fixture.tenantA.tenantId,
        proctoringSessionId: sessionId,
        kind: "webcam",
        objectKey: `proctoring/${sessionId}/fresh.webm`,
        contentType: "video/webm",
      }),
    );

    const run = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      purgeExpiredProctoringMedia(tx, () => Promise.resolve()),
    );
    expect(run.deleted).toBe(0);
  });
});
