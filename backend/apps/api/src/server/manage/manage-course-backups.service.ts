import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  COURSE_BACKUP_DEMO_OTP,
  createManageCourseBackupBodySchema,
  manageCourseBackupDownloadResponseSchema,
  manageCourseBackupResponseSchema,
  manageCourseBackupsListResponseSchema,
  requestCourseBackupOtpResponseSchema,
} from "./manage-course-backups.schemas";
import {
  manageCourseBackupsRepository,
  type CourseBackupJobRow,
} from "./manage-course-backups.repository";

function parseSectionIds(scope: unknown): string[] | null {
  if (!scope || typeof scope !== "object") return null;
  const sectionIds = (scope as { sectionIds?: unknown }).sectionIds;
  if (!Array.isArray(sectionIds)) return null;
  return sectionIds.filter((item): item is string => typeof item === "string");
}

function parseErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function parseSnapshot(scope: unknown): unknown {
  if (!scope || typeof scope !== "object") return null;
  return (scope as { snapshot?: unknown }).snapshot ?? null;
}

function downloadUrlFor(row: CourseBackupJobRow): string | null {
  if (row.status !== "SUCCEEDED") return null;
  if (!row.expires_at || row.expires_at.getTime() < Date.now()) return null;
  return `/api/v1/manage/course-backups/${row.id}/download`;
}

function toDto(row: CourseBackupJobRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    status: row.status as "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED",
    sectionIds: parseSectionIds(row.scope_json),
    downloadUrl: downloadUrlFor(row),
    errorMessage: parseErrorMessage(row.error_json),
    expiresAt: row.expires_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function backupNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Backup not found.",
  });
}

function invalidOtp() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Invalid verification code.",
  });
}

function courseNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found.",
  });
}

export async function listManageCourseBackups(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await manageCourseBackupsRepository.listJobs(tx);
  return manageCourseBackupsListResponseSchema.parse({
    data: { items: rows.map(toDto) },
  });
}

export async function requestManageCourseBackupOtp(_tx: TenantTx, _ctx: ServiceCtx) {
  return requestCourseBackupOtpResponseSchema.parse({
    data: {
      sent: true,
      demoHint: `Use code ${COURSE_BACKUP_DEMO_OTP} for verification.`,
    },
  });
}

export async function createManageCourseBackup(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createManageCourseBackupBodySchema.parse(rawBody);
  if (body.otpCode !== COURSE_BACKUP_DEMO_OTP) {
    throw invalidOtp();
  }

  const course = await manageCourseBackupsRepository.findCourse(tx, body.courseId);
  if (!course) throw courseNotFound();

  const sectionIds = body.sectionIds ?? null;
  const modules = await manageCourseBackupsRepository.listModules(tx, body.courseId, sectionIds);
  const lessons = await manageCourseBackupsRepository.listLessons(
    tx,
    modules.map((module) => module.id),
  );

  const snapshot = {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      metadata: course.metadata_json,
    },
    modules: modules.map((module) => ({
      id: module.id,
      title: module.title,
      position: module.position,
      lessons: lessons
        .filter((lesson) => lesson.module_id === module.id)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          position: lesson.position,
          content: lesson.content_json,
          videoProvider: lesson.video_provider,
          videoUrl: lesson.video_url,
          durationSeconds: lesson.duration_seconds,
        })),
    })),
  };

  const id = await manageCourseBackupsRepository.insertSucceededJob(tx, {
    courseId: course.id,
    courseTitle: course.title,
    requestedByMembershipId: ctx.actorMembershipId,
    scopeJson: { sectionIds },
    snapshot,
  });

  const row = await manageCourseBackupsRepository.findById(tx, id);
  if (!row) throw backupNotFound();
  return manageCourseBackupResponseSchema.parse({ data: toDto(row) });
}

export async function downloadManageCourseBackup(
  tx: TenantTx,
  _ctx: ServiceCtx,
  jobId: string,
) {
  const row = await manageCourseBackupsRepository.findById(tx, jobId);
  if (!row) throw backupNotFound();
  if (row.status !== "SUCCEEDED") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Backup is not ready for download.",
    });
  }
  if (!row.expires_at || row.expires_at.getTime() < Date.now()) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 410,
      message: "Backup download link has expired.",
    });
  }

  return manageCourseBackupDownloadResponseSchema.parse({
    data: {
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      generatedAt: row.completed_at?.toISOString() ?? row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      scope: {
        sectionIds: parseSectionIds(row.scope_json),
      },
      snapshot: parseSnapshot(row.scope_json),
    },
  });
}
