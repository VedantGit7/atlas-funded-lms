import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";

const mocks = vi.hoisted(() => ({
  course: vi.fn(),
  enrollment: vi.fn(),
  lesson: vi.fn(),
  resume: vi.fn(),
  progress: vi.fn(),
  lock: vi.fn(),
  save: vi.fn(),
  completion: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("../../../backend/apps/api/src/server/courses/courses.repository", async (original) => ({
  ...(await original<object>()),
  findCourseAuthProjection: mocks.course,
  findEnrollmentForMembership: mocks.enrollment,
}));
vi.mock("../../../backend/apps/api/src/server/courses/course-authoring.service", () => ({}));
vi.mock("../../../backend/apps/api/src/server/lessons/lessons.repository", async (original) => ({
  ...(await original<object>()),
  findLessonWithModuleAndCourse: mocks.lesson,
  findResumeLessonIdForLearner: mocks.resume,
  listPublishedLessonNavigation: vi.fn(async () => ({})),
}));
vi.mock("../../../backend/apps/api/src/server/lessons/lesson-progress.repository", () => ({
  findLessonProgress: mocks.progress,
  lockEnrollmentForProgress: mocks.lock,
  upsertLessonProgress: mocks.save,
  markEnrollmentCompletedIfAllLessonsDone: mocks.completion,
}));
vi.mock("../../../backend/apps/api/src/server/tags/tags.service", () => ({
  listTagsForLesson: vi.fn(async () => []),
  mapTagSummary: vi.fn(),
}));
vi.mock("@atlas/storage/lesson-asset.service", () => ({ createLessonAssetDownload: vi.fn() }));
vi.mock("@atlas/events", () => ({ outbox: { publish: mocks.publish } }));
vi.mock("@atlas/audit", () => ({ auditWriter: { write: vi.fn() } }));
vi.mock("@atlas/api/rate-limit", () => ({
  enforceProtectedRateLimit: vi.fn(),
  enforceIngressRateLimit: vi.fn(),
}));

import {
  loadCourseResourceRef,
  loadLessonParentCourseResourceRef,
} from "../../../backend/apps/api/src/server/courses/load-course-resource-ref";
import { getPublishedCourseDetail } from "../../../backend/apps/api/src/server/courses/courses.service";
import { getLesson } from "../../../backend/apps/api/src/server/lessons/lessons.service";
import { recordLessonProgress } from "../../../backend/apps/api/src/server/lessons/lesson-progress.service";
import { runProtectedTenantRouteHandler } from "@atlas/api/create-tenant-route";

const ctx = { tenantId: "tenant-a", actorMembershipId: "member-a", requestId: "request-a" };
const tx = {} as TenantTx;
const course = {
  id: "course-a",
  tenantId: "tenant-a",
  status: "PUBLISHED",
  slug: "course",
  title: "Course",
  description: null,
  metadataJson: null,
  createdByMembershipId: "instructor",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const lesson = {
  id: "lesson-a",
  tenantId: "tenant-a",
  courseId: "course-a",
  moduleId: "module-a",
  status: "PUBLISHED",
  courseStatus: "PUBLISHED",
  contentJson: null,
  durationSeconds: 100,
  videoProvider: null,
  videoUrl: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.course.mockResolvedValue({ ...course });
  mocks.lesson.mockResolvedValue({ ...lesson });
  mocks.enrollment.mockResolvedValue({
    id: "enrollment-a",
    status: "active",
    enrolledAt: new Date(),
  });
  mocks.resume.mockResolvedValue("lesson-a");
  mocks.progress.mockResolvedValue(null);
  mocks.lock.mockResolvedValue(true);
  mocks.save.mockResolvedValue({
    status: "in_progress",
    progressPct: 20,
    completedAt: null,
    lastSeenAt: null,
  });
});

describe("authorization-loaded learner projections", () => {
  it("checks fresh permission overrides before reusing the next request's projections", async () => {
    // One authorization statement per request: allowed by role, then denied by
    // an override added in between.
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          permission_exists: true,
          override_effect: null,
          role_keys: ["learner"],
          bypasses_resource_predicates: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          permission_exists: true,
          override_effect: "DENY",
          role_keys: ["learner"],
          bypasses_resource_predicates: false,
        },
      ]);
    const authTx = { $queryRaw: query } as unknown as TenantTx;
    const handler = vi.fn(
      async ({ resource }: { resource: Awaited<ReturnType<typeof loadCourseResourceRef>> }) =>
        getPublishedCourseDetail(authTx, ctx, course.id, undefined, resource),
    );
    const args = {
      tx: authTx,
      ctx,
      params: {},
      input: undefined,
      metadata: {
        permission: "course.read" as const,
        rateLimit: "authenticatedTenantRead" as const,
        audit: "none" as const,
        idempotency: "none" as const,
        resourceLoader: () => loadCourseResourceRef({ tx: authTx, ctx, courseId: course.id }),
      },
      handler,
    };
    await runProtectedTenantRouteHandler(args);
    await expect(runProtectedTenantRouteHandler(args)).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mocks.course).toHaveBeenCalledTimes(2);
    expect(mocks.enrollment).toHaveBeenCalledTimes(2);
  });
  it("reads a course and enrollment once for loader plus detail handler", async () => {
    const resource = await loadCourseResourceRef({ tx, ctx, courseId: course.id });
    const result = await getPublishedCourseDetail(tx, ctx, course.id, undefined, resource);
    expect(result.data).toMatchObject({
      id: course.id,
      enrollmentStatus: "enrolled",
      resumeLessonId: "lesson-a",
    });
    expect(mocks.course).toHaveBeenCalledTimes(1);
    expect(mocks.enrollment).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(resource)).not.toContain("metadataJson");
  });

  it("reads a lesson and enrollment once for loader plus player handler", async () => {
    const resource = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
    expect((await getLesson(tx, ctx, lesson.id, undefined, resource)).data).toMatchObject({
      id: lesson.id,
    });
    expect(mocks.lesson).toHaveBeenCalledTimes(1);
    expect(mocks.course).toHaveBeenCalledTimes(1);
    expect(mocks.enrollment).toHaveBeenCalledTimes(1);
    expect(mocks.progress).toHaveBeenCalledTimes(1);
  });

  it("reuses lesson/enrollment while retaining the lock before the fresh progress read", async () => {
    const resource = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
    await recordLessonProgress(tx, ctx, lesson.id, { positionSeconds: 20 }, resource);
    expect(mocks.lesson).toHaveBeenCalledTimes(1);
    expect(mocks.enrollment).toHaveBeenCalledTimes(1);
    expect(mocks.lock).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        tenantId: ctx.tenantId,
        membershipId: ctx.actorMembershipId,
        enrollmentId: "enrollment-a",
      }),
    );
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.progress.mock.invocationCallOrder[0] ?? -1,
    );
    expect(mocks.progress).toHaveBeenCalledTimes(1);
  });

  it("rejects enrollment revoked while a progress writer waits for the lock", async () => {
    const resource = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
    mocks.lock.mockResolvedValue(false);
    await expect(
      recordLessonProgress(tx, ctx, lesson.id, { positionSeconds: 20 }, resource),
    ).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it.each(["transaction", "request", "actor", "tenant", "resource"])(
    "does not reuse a projection for a different %s",
    async (boundary) => {
      const resource = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
      mocks.lesson.mockResolvedValue(null);
      const otherCtx =
        boundary === "request"
          ? { ...ctx }
          : boundary === "actor"
            ? { ...ctx, actorMembershipId: "member-b" }
            : boundary === "tenant"
              ? { ...ctx, tenantId: "tenant-b" }
              : ctx;
      await expect(
        getLesson(
          boundary === "transaction" ? ({} as TenantTx) : tx,
          otherCtx,
          boundary === "resource" ? "lesson-b" : lesson.id,
          undefined,
          resource,
        ),
      ).rejects.toThrow();
      expect(mocks.lesson).toHaveBeenCalledTimes(2);
    },
  );

  it("reloads enrollment on the next request and denies removed enrollment", async () => {
    const first = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
    await getLesson(tx, ctx, lesson.id, undefined, first);
    mocks.enrollment.mockResolvedValue(null);
    const nextCtx = { ...ctx, requestId: "request-b" };
    const second = await loadLessonParentCourseResourceRef({
      tx,
      ctx: nextCtx,
      lessonId: lesson.id,
    });
    await expect(getLesson(tx, nextCtx, lesson.id, undefined, second)).rejects.toThrow();
    expect(mocks.enrollment).toHaveBeenCalledTimes(2);
  });

  it.each(["DRAFT", "ARCHIVED"])(
    "still denies %s lessons even when the published parent authorized course.read",
    async (status) => {
      mocks.lesson.mockResolvedValue({ ...lesson, status });
      const resource = await loadLessonParentCourseResourceRef({ tx, ctx, lessonId: lesson.id });
      await expect(getLesson(tx, ctx, lesson.id, undefined, resource)).rejects.toThrow();
      await expect(recordLessonProgress(tx, ctx, lesson.id, {}, resource)).rejects.toThrow();
      expect(mocks.progress).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it("reloads publication state on every resource load", async () => {
    await loadCourseResourceRef({ tx, ctx, courseId: course.id });
    mocks.course.mockResolvedValue({ ...course, status: "DRAFT" });
    await expect(loadCourseResourceRef({ tx, ctx, courseId: course.id })).rejects.toThrow();
    expect(mocks.course).toHaveBeenCalledTimes(2);
  });
});
