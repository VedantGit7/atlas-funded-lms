import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "./courses.errors";
import { findResumeLessonIdForLearner } from "../lessons/lessons.repository";
import {
  findCourseAuthProjection,
  findEnrollmentForMembership,
  listPublishedCourseModules,
  listPublishedCoursesPaginated,
  readCoursePricing,
} from "./courses.repository";
import type { CourseListQuery } from "./schemas";
import { studioCourseListQuerySchema, type CourseDetailQuery } from "./course-authoring-schemas";
import {
  getCourseForBuilder,
  listCourseModulesForBuilderService,
  listStudioCourses,
} from "./course-authoring.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId?: string;
};

function learnerMetadataProjection(metadata: Record<string, unknown> | null): {
  coverKey: string | null;
  tags: Record<string, unknown> | undefined;
} {
  if (!metadata) {
    return { coverKey: null, tags: undefined };
  }

  const coverKey =
    typeof metadata["coverKey"] === "string"
      ? metadata["coverKey"]
      : typeof metadata["thumbnailKey"] === "string"
        ? metadata["thumbnailKey"]
        : null;

  const tags =
    metadata["tags"] && typeof metadata["tags"] === "object" && !Array.isArray(metadata["tags"])
      ? (metadata["tags"] as Record<string, unknown>)
      : undefined;

  return { coverKey, tags };
}

function assertLearnerVisiblePublishedCourse(status: string): void {
  if (status !== "PUBLISHED") {
    throw courseNotFound();
  }
}

export async function listPublishedCourses(tx: TenantTx, ctx: ServiceCtx, query: CourseListQuery) {
  if (query.view === "studio") {
    return listStudioCourses(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId ?? "list",
      },
      studioCourseListQuerySchema.parse(query),
    );
  }

  const result = await listPublishedCoursesPaginated({
    tx,
    membershipId: ctx.actorMembershipId,
    query,
  });

  return {
    data: {
      items: result.items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        status: item.status,
        coverKey: item.coverKey,
        tags: item.tags,
        accessTier: item.accessTier,
        priceCents: item.priceCents,
        currency: item.currency,
        locked: item.locked,
        level: item.level,
        category: item.category,
        featured: item.featured,
        trending: item.trending,
        compareAtPriceCents: item.compareAtPriceCents,
        durationSeconds: item.durationSeconds,
        studentCount: item.studentCount,
        instructor: item.instructor,
        progressPct: item.progressPct,
        ratingAverage: item.ratingAverage,
        ratingCount: item.ratingCount,
        enrollmentStatus: item.enrollmentStatus,
        updatedAt: item.updatedAt.toISOString(),
      })),
      pageInfo: result.pageInfo,
    },
  };
}

export async function getPublishedCourseDetail(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query?: CourseDetailQuery,
) {
  if (query?.view === "studio") {
    return getCourseForBuilder(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId ?? "detail",
      },
      courseId,
    );
  }

  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  assertLearnerVisiblePublishedCourse(course.status);

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId,
    membershipId: ctx.actorMembershipId,
  });

  const meta = learnerMetadataProjection(course.metadataJson);
  const pricing = readCoursePricing(course.metadataJson);
  const enrollmentStatus = enrollment ? ("enrolled" as const) : ("not_enrolled" as const);
  const resumeLessonId =
    enrollment != null
      ? await findResumeLessonIdForLearner({
          tx,
          courseId,
          membershipId: ctx.actorMembershipId,
        })
      : null;

  return {
    data: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      status: "PUBLISHED" as const,
      coverKey: meta.coverKey,
      tags: meta.tags,
      accessTier: pricing.accessTier,
      priceCents: pricing.priceCents,
      currency: pricing.currency,
      locked: pricing.accessTier === "PAID" && enrollmentStatus !== "enrolled",
      enrollmentStatus,
      enrolledAt: enrollment?.enrolledAt.toISOString() ?? null,
      resumeLessonId,
      updatedAt: course.updatedAt.toISOString(),
      createdAt: course.createdAt.toISOString(),
    },
  };
}

export async function getPublishedCourseModules(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query?: CourseDetailQuery,
) {
  if (query?.view === "studio") {
    return listCourseModulesForBuilderService(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId ?? "modules",
      },
      courseId,
    );
  }

  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  assertLearnerVisiblePublishedCourse(course.status);

  const modules = await listPublishedCourseModules({ tx, courseId });

  return {
    data: {
      items: modules,
    },
  };
}

export { findCourseAuthProjection, findEnrollmentForMembership };
