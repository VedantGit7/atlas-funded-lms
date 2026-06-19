import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { learningPathListQuerySchema } from "../../../apps/web/src/server/learning-paths/learning-path.schemas";
import {
  createLearningPathDraft,
  deleteLearningPath,
  enrollCurrentMemberInPath,
  getLearningPathById,
  getLearningPathProgress,
  listLearningPaths,
  submitLearningPathForReview,
  updateLearningPath,
} from "../../../apps/web/src/server/learning-paths/learning-path.service";
import {
  authoringTenantTx,
  createLearningPathFixture,
  instructorCtx,
  learnerCtx,
  learnerTenantTx,
} from "../../fixtures/learning-path-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("learning paths integration", () => {
  it("learner list returns only published paths", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = learnerCtx(fixture);

    const result = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      listLearningPaths(tx, ctx, learningPathListQuerySchema.parse({})),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.publishedPathId);
    expect(ids).not.toContain(fixture.draftPathId);
  });

  it("creates draft path with server membership", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = instructorCtx(fixture);

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createLearningPathDraft(tx, ctx, { title: "New Draft Path", pathType: "program" }),
    );

    expect(created.data.status).toBe("DRAFT");
  });

  it("returns detail with steps and gates", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = learnerCtx(fixture);

    const detail = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      getLearningPathById(tx, ctx, fixture.publishedPathId, {}),
    );

    expect(detail.data.steps).toHaveLength(1);
    expect(detail.data.steps[0]?.gates[0]?.gateType).toBe("open");
  });

  it("updates metadata and replaces steps transactionally", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = instructorCtx(fixture);

    const updated = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      updateLearningPath(tx, ctx, fixture.draftPathId, {
        title: "Updated Draft Path",
        steps: [
          {
            stepType: "course",
            refId: fixture.publishedCourseId,
            title: "Step 1",
            position: 1,
            gates: [{ gateType: "open", config: {} }],
          },
        ],
      }),
    );

    expect(updated.data.title).toBe("Updated Draft Path");
    expect(updated.data.steps).toHaveLength(1);
  });

  it("soft deletes path and writes audit", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = instructorCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await updateLearningPath(tx, ctx, fixture.draftPathId, {
        steps: [
          {
            stepType: "course",
            refId: fixture.publishedCourseId,
            title: "Step 1",
            position: 1,
            gates: [{ gateType: "open", config: {} }],
          },
        ],
      });
      await deleteLearningPath(tx, ctx, fixture.draftPathId);

      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.draftPathId}
          and action = 'learning_path.deleted'
        limit 1
      `;
      expect(rows).toHaveLength(1);
    });
  });

  it("publish submits for review without direct publish", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = instructorCtx(fixture);

    const result = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await updateLearningPath(tx, ctx, fixture.draftPathId, {
        steps: [
          {
            stepType: "course",
            refId: fixture.publishedCourseId,
            title: "Step 1",
            position: 1,
            gates: [{ gateType: "open", config: {} }],
          },
        ],
      });
      return submitLearningPathForReview(tx, ctx, fixture.draftPathId, {});
    });

    expect(result.data.status).toBe("REVIEW");
  });

  it("enrolls self in published path with duplicate safety", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = learnerCtx(fixture);

    const first = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      enrollCurrentMemberInPath(tx, ctx, fixture.publishedPathId),
    );
    const second = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      enrollCurrentMemberInPath(tx, ctx, fixture.publishedPathId),
    );

    expect(first.data.created).toBe(true);
    expect(second.data.created).toBe(false);
    expect(second.data.id).toBe(first.data.id);
  });

  it("returns progress with locked/unlocked gates", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = learnerCtx(fixture);

    const progress = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      getLearningPathProgress(tx, ctx, fixture.publishedPathId),
    );

    expect(progress.data.enrolled).toBe(false);
    expect(progress.data.steps[0]?.gates[0]?.state).toBe("satisfied");
    expect(progress.data.steps[0]?.locked).toBe(true);
  });
});
