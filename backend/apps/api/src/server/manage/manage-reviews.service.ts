import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  createManageReviewBodySchema,
  manageReviewResponseSchema,
  manageReviewsListResponseSchema,
  manageReviewsQuerySchema,
  updateManageReviewBodySchema,
  deleteManageReviewResponseSchema,
} from "./manage-reviews.schemas";
import { manageReviewsRepository, type ManageReviewRow } from "./manage-reviews.repository";

function toDto(row: ManageReviewRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    membershipId: row.membership_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    rating: row.rating,
    comment: row.comment,
    status: row.status as "PENDING" | "APPROVED" | "REJECTED",
    adminNote: row.admin_note,
    addedByAcademy: row.added_by_academy,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function reviewNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Review not found.",
  });
}

export async function listManageReviews(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = manageReviewsQuerySchema.parse(rawQuery ?? {});
  const rows = await manageReviewsRepository.listReviews(tx, {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    limit: query.limit,
  });
  return manageReviewsListResponseSchema.parse({ data: { items: rows.map(toDto) } });
}

export async function updateManageReview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  reviewId: string,
  rawBody: unknown,
) {
  const body = updateManageReviewBodySchema.parse(rawBody);
  // A learner's rating and words are theirs: admins approve, reject or note
  // them, and change only the academy's own reviews (QA review 1 M18, D8).
  if (body.rating !== undefined || body.comment !== undefined) {
    const existing = await manageReviewsRepository.findById(tx, reviewId);
    if (!existing) throw reviewNotFound();
    if (!existing.added_by_academy) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 409,
        message:
          "This is a learner's review. You can approve, reject or add a note to it, but not change their rating or words.",
      });
    }
  }
  const updated = await manageReviewsRepository.updateReview(tx, reviewId, {
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.comment !== undefined ? { comment: body.comment } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.adminNote !== undefined ? { adminNote: body.adminNote } : {}),
  });
  if (!updated) throw reviewNotFound();
  return manageReviewResponseSchema.parse({ data: toDto(updated) });
}

export async function deleteManageReview(tx: TenantTx, _ctx: ServiceCtx, reviewId: string) {
  const deleted = await manageReviewsRepository.deleteReview(tx, reviewId);
  if (!deleted) throw reviewNotFound();
  return deleteManageReviewResponseSchema.parse({ data: { id: reviewId, deleted: true } });
}

/**
 * The academy's own review of a course (owner decision D8: keep, labelled).
 * It is written under the admin's membership and marked, so learners see it
 * as "Added by the academy" and it stays out of the star average. Choosing a
 * learner to write as is no longer possible: it replaced their real review.
 */
export async function createManageReview(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createManageReviewBodySchema.parse(rawBody);
  const written = await manageReviewsRepository.insertAdminReview(tx, {
    courseId: body.courseId,
    membershipId: ctx.actorMembershipId,
    rating: body.rating,
    comment: body.comment ?? null,
    status: body.status,
  });
  if ("conflict" in written) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message:
        "You've reviewed this course yourself as a learner, so an academy review can't be added from your account.",
    });
  }
  const row = await manageReviewsRepository.findById(tx, written.id);
  if (!row) throw reviewNotFound();
  return manageReviewResponseSchema.parse({ data: toDto(row) });
}
