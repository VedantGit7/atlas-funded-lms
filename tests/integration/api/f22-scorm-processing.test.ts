import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  createCourseAuthoringFixture,
  authoringTenantTx,
  instructorCtx,
} from "../../fixtures/course-authoring-fixture";
import { insertCourseModule } from "../../../backend/apps/api/src/server/courses/course-authoring.repository";
import { insertPendingAssetReference } from "@atlas/storage/asset-reference.repository";
import { confirmModuleScormPackageUploadService } from "../../../backend/apps/api/src/server/courses/module-scorm.service";
import {
  loadScormProcessingSource,
  completeScormProcessing,
} from "../../../backend/apps/api/src/server/courses/scorm-processing.repository";
import { createScormHandler } from "../../../backend/apps/api/src/server/courses/scorm-worker-router";
import {
  materializeDeliveryJobs,
  claimDeliveryJob,
} from "@atlas/events/repositories/outbox-job.repository";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
const storage = vi.hoisted(() => ({
  headObject: vi.fn().mockResolvedValue({ contentType: "application/zip", sizeBytes: 10 }),
  getObjectBody: vi.fn(),
  getObjectStream: vi.fn(),
  putObject: vi.fn(),
}));
vi.mock("@atlas/storage/providers/storage-provider-factory", () => ({
  getStorageProvider: () => storage,
}));
const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;
suite("F22 SCORM durable processing", () => {
  it("commits confirmation without downloading bytes and recovers a lost claim with fenced publication", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);
    const transaction = <T>(fn: (tx: TenantTx) => Promise<T>) =>
      withTenantTx(authoringTenantTx(fixture), fn);
    const module = await transaction((tx) =>
      insertCourseModule({
        tx,
        tenantId: fixture.tenantId,
        courseId: fixture.draftCourseId,
        title: "SCORM restart",
        position: 1,
        contentKind: "scorm",
      }),
    );
    const asset = await transaction((tx) =>
      insertPendingAssetReference(tx, {
        tenantId: fixture.tenantId,
        bucket: "test",
        key: `tenants/${fixture.tenantId}/scorm.zip`,
        purpose: "module.scorm",
        resourceType: "course_module",
        resourceId: module.id,
        fileName: "scorm.zip",
        contentType: "application/zip",
        sizeBytes: 10,
        checksumSha256: null,
        visibility: "private",
      }),
    );
    const confirmed = await transaction((tx) =>
      confirmModuleScormPackageUploadService(tx, ctx, module.id, { assetReferenceId: asset.id }),
    );
    expect(confirmed.data.scormPackageReady).toBe(false);
    expect(storage.getObjectBody).not.toHaveBeenCalled();
    expect(storage.getObjectStream).not.toHaveBeenCalled();
    const subscriptions = [
      {
        eventType: "course.module.scorm_processing_requested",
        destinationKey: "scorm.package.process",
      },
    ];
    await transaction((tx) => materializeDeliveryJobs(tx, subscriptions, 1, 4));
    const interrupted = await transaction((tx) => claimDeliveryJob(tx, subscriptions));
    expect(interrupted).not.toBeNull();
    if (!interrupted) throw new Error("Claim missing");
    const work = { tenantId: fixture.tenantId, moduleId: module.id, assetReferenceId: asset.id };
    expect(await transaction((tx) => loadScormProcessingSource(tx, work))).not.toBeNull();
    const oldVersion = randomUUID();
    const completion = {
      ...work,
      eventId: interrupted.event.id,
      attempt: 1,
      contentVersion: oldVersion,
      launchPath: "old.html",
      scormVersion: "1.2",
    };
    // Transaction-start now() must not keep a lease alive after wall-clock expiry.
    await transaction(async (tx) => {
      await tx.$executeRaw`UPDATE outbox_delivery_jobs SET lease_until=clock_timestamp()+interval '50 milliseconds' WHERE id=${interrupted.job.id}::uuid`;
      await tx.$queryRaw`SELECT pg_sleep(0.1)::text`;
      await completeScormProcessing(tx, completion);
    });
    const beforeRecovery = await transaction(
      (tx) =>
        tx.$queryRaw<
          Array<{ scorm_launch_path: string | null }>
        >`SELECT scorm_launch_path FROM course_modules WHERE id=${module.id}::uuid`,
    );
    expect(beforeRecovery[0]?.scorm_launch_path).toBeNull();

    // A valid claim can expire while publication waits for the module row.
    let releaseModule = () => {};
    let signalModuleLocked = () => {};
    const moduleGate = new Promise<void>((resolve) => {
      releaseModule = resolve;
    });
    const moduleLocked = new Promise<void>((resolve) => {
      signalModuleLocked = resolve;
    });
    const holdingModule = transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM course_modules WHERE id=${module.id}::uuid FOR UPDATE`;
      signalModuleLocked();
      await moduleGate;
    });
    await moduleLocked;
    await transaction(
      (tx) =>
        tx.$executeRaw`UPDATE outbox_delivery_jobs SET lease_until=clock_timestamp()+interval '300 milliseconds' WHERE id=${interrupted.job.id}::uuid`,
    );
    const waitingPublication = transaction((tx) => completeScormProcessing(tx, completion));
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
    } finally {
      releaseModule();
      await holdingModule;
      await waitingPublication;
    }
    const afterModuleWait = await transaction(
      (tx) =>
        tx.$queryRaw<
          Array<{ scorm_launch_path: string | null }>
        >`SELECT scorm_launch_path FROM course_modules WHERE id=${module.id}::uuid`,
    );
    expect(afterModuleWait[0]?.scorm_launch_path).toBeNull();

    // A completion must lock the claim, not publish from a stale MVCC snapshot
    // while a newer attempt is still committing its claim.
    await transaction(
      (tx) =>
        tx.$executeRaw`UPDATE outbox_delivery_jobs SET lease_until=clock_timestamp()+interval '1 minute' WHERE id=${interrupted.job.id}::uuid`,
    );
    let releaseClaim = () => {};
    let signalClaimLocked = () => {};
    const claimGate = new Promise<void>((resolve) => {
      releaseClaim = resolve;
    });
    const claimLocked = new Promise<void>((resolve) => {
      signalClaimLocked = resolve;
    });
    const replacingClaim = transaction(async (tx) => {
      await tx.$executeRaw`UPDATE outbox_delivery_jobs SET attempt_count=2 WHERE id=${interrupted.job.id}::uuid`;
      signalClaimLocked();
      await claimGate;
    });
    await claimLocked;
    let completed = false;
    const staleCompletion = transaction((tx) => completeScormProcessing(tx, completion)).then(
      () => {
        completed = true;
      },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(completed).toBe(false);
    } finally {
      releaseClaim();
      await replacingClaim;
      await staleCompletion;
    }
    const afterClaimRace = await transaction(
      (tx) =>
        tx.$queryRaw<
          Array<{ scorm_launch_path: string | null }>
        >`SELECT scorm_launch_path FROM course_modules WHERE id=${module.id}::uuid`,
    );
    expect(afterClaimRace[0]?.scorm_launch_path).toBeNull();
    // Restore the original interrupted attempt for the recovery assertions below.
    await transaction(
      (tx) =>
        tx.$executeRaw`UPDATE outbox_delivery_jobs SET attempt_count=1 WHERE id=${interrupted.job.id}::uuid`,
    );
    await transaction(
      (tx) =>
        tx.$executeRaw`UPDATE outbox_delivery_jobs SET lease_until=now()-interval '1 minute' WHERE id=${interrupted.job.id}::uuid`,
    );
    await transaction((tx) => completeScormProcessing(tx, completion));
    const state = () =>
      transaction(
        (tx) =>
          tx.$queryRaw<
            Array<{ scorm_content_version: string | null; scorm_launch_path: string | null }>
          >`SELECT scorm_content_version::text,scorm_launch_path FROM course_modules WHERE id=${module.id}::uuid`,
      );
    expect((await state())[0]?.scorm_launch_path).toBeNull();
    let publishes = 0;
    const handler = createScormHandler({
      load: (input) => transaction((tx) => loadScormProcessingSource(tx, input)),
      publish: async () => {
        publishes++;
        return { launchPath: "index.html", scormVersion: "1.2" };
      },
      complete: (input) => transaction((tx) => completeScormProcessing(tx, input)),
    });
    const run = () =>
      processOutboxBatch(
        { transaction },
        {
          limit: 1,
          maxRetries: 3,
          handlers: { "course.module.scorm_processing_requested": [handler] },
        },
      );
    expect((await run()).delivered).toBe(1);
    const ready = (await state())[0];
    expect(ready?.scorm_launch_path).toBe("index.html");
    expect(ready?.scorm_content_version).not.toBeNull();
    expect(ready?.scorm_content_version).not.toBe(oldVersion);
    await transaction((tx) => completeScormProcessing(tx, completion));
    expect((await state())[0]).toEqual(ready);
    expect((await run()).processed).toBe(0);
    expect(publishes).toBe(1);
    await transaction(
      (tx) =>
        tx.$executeRaw`UPDATE course_modules SET scorm_package_reference_id=NULL WHERE id=${module.id}::uuid`,
    );
    expect(await transaction((tx) => loadScormProcessingSource(tx, work))).toBeNull();
  });
});
