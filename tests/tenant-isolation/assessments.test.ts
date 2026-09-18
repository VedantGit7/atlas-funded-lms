import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getAssessment,
  updateAssessment,
} from "../../backend/apps/api/src/server/assessments/assessments.service";
import {
  startAttempt,
  getAttempt,
} from "../../backend/apps/api/src/server/attempts/attempts.service";
import {
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  publishAssessmentFixture,
  authoringTenantTx,
} from "../fixtures/assessment-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("assessment tenant isolation", () => {
  it("blocks cross-tenant assessment read", async () => {
    const fixtureA = await createAssessmentFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getAssessment(tx, instructorCtx(fixtureA, "iso_read"), fixtureA.assessmentId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks cross-tenant assessment update", async () => {
    const fixtureA = await createAssessmentFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        updateAssessment(tx, instructorCtx(fixtureA, "iso_update"), fixtureA.assessmentId, {
          title: "Hijacked",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks cross-tenant attempt start", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        startAttempt(tx, learnerCtx(fixtureA, "iso_start"), fixtureA.assessmentId, "iso-start-key"),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks cross-tenant attempt read", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixtureA, "iso_attempt_read");

    const started = await withTenantTx(
      authoringTenantTx(fixtureA, fixtureA.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixtureA.assessmentId, "iso-start-read"),
    );

    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getAttempt(tx, learner, started.data.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
