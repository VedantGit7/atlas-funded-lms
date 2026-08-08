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

export async function createManageReview(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createManageReviewBodySchema.parse(rawBody);
  const membershipId = body.membershipId ?? ctx.actorMembershipId;
  const id = await manageReviewsRepository.insertAdminReview(tx, {
    courseId: body.courseId,
    membershipId,
    rating: body.rating,
    comment: body.comment ?? null,
    status: body.status,
  });
  const row = await manageReviewsRepository.findById(tx, id);
  if (!row) throw reviewNotFound();
  return manageReviewResponseSchema.parse({ data: toDto(row) });
}
