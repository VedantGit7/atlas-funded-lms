import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { subSchoolNotFound } from "./sub-schools.errors";
import { subSchoolsRepository } from "./sub-schools.repository";
import {
  createProductCopyJobBodySchema,
  productCopyJobListResponseSchema,
  productCopyJobResponseSchema,
} from "./product-copy.dto";
import {
  productCopyDestinationRequired,
  productCopySourceNotFound,
} from "./product-copy.errors";
import {
  productCopyRepository,
  type ProductCopyJobRow,
} from "./product-copy.repository";

function parseSectionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function parseErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function toDto(row: ProductCopyJobRow) {
  return {
    id: row.id,
    destinationSubSchoolId: row.destination_sub_school_id,
    productType: row.product_type,
    sourceProductId: row.source_product_id,
    sourceProductTitle: row.source_product_title,
    destinationProductName: row.destination_product_name,
    sectionIds: parseSectionIds(row.section_ids_json),
    resultProductId: row.result_product_id,
    status: row.status,
    errorMessage: parseErrorMessage(row.error_json),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function allocateUniqueSlug(tx: TenantTx, title: string): Promise<string> {
  const base = slugifyTitle(title) || "copied-course";
  let candidate = base;
  let attempt = 0;
  while (await productCopyRepository.courseSlugExists(tx, candidate)) {
    attempt += 1;
    candidate = `${base}-copy${attempt > 1 ? `-${attempt}` : ""}`.slice(0, 100);
    if (attempt > 50) {
      candidate = `${base}-${Date.now().toString(36)}`.slice(0, 100);
      break;
    }
  }
  return candidate;
}

async function cloneCourseForSubSchool(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    sourceCourseId: string;
    destinationSubSchoolId: string;
    destinationTitle: string;
    sectionIds: string[] | null;
  },
): Promise<string> {
  const source = await productCopyRepository.findCourseById(tx, args.sourceCourseId);
  if (!source) throw productCopySourceNotFound();

  const sourceMetadata =
    source.metadata_json && typeof source.metadata_json === "object"
      ? (source.metadata_json as Record<string, unknown>)
      : {};

  const slug = await allocateUniqueSlug(tx, args.destinationTitle);
  const courseId = await productCopyRepository.insertCourseDraft(tx, {
    ownerMembershipId: ctx.actorMembershipId,
    slug,
    title: args.destinationTitle,
    description: source.description,
    metadata: {
      ...sourceMetadata,
      subSchoolId: args.destinationSubSchoolId,
      copiedFromCourseId: source.id,
      copiedAt: new Date().toISOString(),
    },
  });

  await productCopyRepository.copyCourseTags(tx, source.id, courseId);

  const modules = await productCopyRepository.listModulesForCourse(
    tx,
    source.id,
    args.sectionIds,
  );

  let position = 1;
  for (const module of modules) {
    const newModuleId = await productCopyRepository.insertModule(tx, {
      courseId,
      title: module.title,
      position,
      contentKind: module.content_kind === "SCORM" ? "SCORM" : "STANDARD",
      scormPackageReferenceId: module.scorm_package_reference_id,
      scormLaunchPath: module.scorm_launch_path,
      scormVersion: module.scorm_version,
    });
    position += 1;

    const lessons = await productCopyRepository.listLessonsForModule(tx, module.id);
    for (const lesson of lessons) {
      const newLessonId = await productCopyRepository.insertLesson(tx, {
        moduleId: newModuleId,
        slug: lesson.slug,
        title: lesson.title,
        contentJson: lesson.content_json,
        videoProvider: lesson.video_provider,
        videoUrl: lesson.video_url,
        durationSeconds: lesson.duration_seconds,
        position: lesson.position,
      });
      await productCopyRepository.copyLessonAssets(tx, lesson.id, newLessonId);
      await productCopyRepository.copyLessonTags(tx, lesson.id, newLessonId);
    }
  }

  return courseId;
}

export async function listProductCopyJobs(
  tx: TenantTx,
  _ctx: ServiceCtx,
  subSchoolId: string,
) {
  const subSchool = await subSchoolsRepository.findSubSchoolById(tx, subSchoolId);
  if (!subSchool) throw subSchoolNotFound();

  const rows = await productCopyRepository.listJobsForSubSchool(tx, subSchoolId);
  return productCopyJobListResponseSchema.parse({
    data: { items: rows.map(toDto) },
  });
}

export async function createProductCopyJob(
  tx: TenantTx,
  ctx: ServiceCtx,
  subSchoolId: string,
  rawBody: unknown,
) {
  const body = createProductCopyJobBodySchema.parse(rawBody);
  const destinationName = body.destinationProductName.trim();
  if (!destinationName) throw productCopyDestinationRequired();

  const subSchool = await subSchoolsRepository.findSubSchoolById(tx, subSchoolId);
  if (!subSchool) throw subSchoolNotFound();

  const sectionIds =
    body.sectionIds && body.sectionIds.length > 0 ? body.sectionIds : null;

  const job = await productCopyRepository.insertJob(tx, {
    destinationSubSchoolId: subSchoolId,
    requestedByMembershipId: ctx.actorMembershipId,
    productType: body.productType,
    sourceProductId: body.sourceProductId,
    sourceProductTitle: body.sourceProductTitle.trim(),
    destinationProductName: destinationName,
    sectionIds,
  });

  await productCopyRepository.markRunning(tx, job.id);

  if (body.productType !== "COURSE") {
    const message =
      body.productType === "MOCK_TEST"
        ? "Copying mock-tests is not available yet."
        : "Copying test series is not available yet.";
    const failed = await productCopyRepository.markFailed(tx, job.id, message);
    return productCopyJobResponseSchema.parse({ data: toDto(failed ?? job) });
  }

  // Clone runs in the same transaction. On failure we rethrow so partial course
  // rows roll back with the job row (avoids orphan drafts).
  const resultProductId = await cloneCourseForSubSchool(tx, ctx, {
    sourceCourseId: body.sourceProductId,
    destinationSubSchoolId: subSchoolId,
    destinationTitle: destinationName,
    sectionIds,
  });
  const succeeded = await productCopyRepository.markSucceeded(tx, job.id, resultProductId);
  return productCopyJobResponseSchema.parse({ data: toDto(succeeded ?? job) });
}
