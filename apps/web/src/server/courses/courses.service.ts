import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "./courses.errors";
import {
  findCourseAuthProjection,
  findEnrollmentForMembership,
  listPublishedCourseModules,
  listPublishedCoursesPaginated,
} from "./courses.repository";
import type { CourseListQuery } from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
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
        enrollmentStatus: item.enrollmentStatus,
        updatedAt: item.updatedAt.toISOString(),
      })),
      pageInfo: result.pageInfo,
    },
  };
}

export async function getPublishedCourseDetail(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
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

  return {
    data: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      status: "PUBLISHED" as const,
      coverKey: meta.coverKey,
      tags: meta.tags,
      enrollmentStatus: enrollment ? ("enrolled" as const) : ("not_enrolled" as const),
      enrolledAt: enrollment?.enrolledAt.toISOString() ?? null,
      updatedAt: course.updatedAt.toISOString(),
      createdAt: course.createdAt.toISOString(),
    },
  };
}

export async function getPublishedCourseModules(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
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
