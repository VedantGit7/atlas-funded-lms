import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  confirmAssetUpload,
  createSignedAssetDownload,
} from "@atlas/storage/asset-reference.service";
import { updatePendingAssetReferenceSizeBytes } from "@atlas/storage/asset-reference.repository";
import { contentDispositionFor } from "@atlas/storage/content-disposition";
import { assertLocalBlobUpload, readLocalBlobBody } from "@atlas/storage/local-blob-upload";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import { createSignedUpload } from "@atlas/storage/signed-upload";
import { assertAllowedSize } from "@atlas/storage/size-policy";
import { assessmentsRepository } from "../assessments/assessments.repository";
import { gradingRepository } from "../grading/grading.repository";
import { gradingTaskNotFound } from "../grading/grading.errors";
import {
  ANSWER_FILE_TYPES,
  answerFileProblem,
  answerFileRules,
  fileExtension,
  isAnswerFileType,
} from "../item-registry/answer-rules.contract";
import {
  decodeExplanationJson,
  itemRegistryRepository,
} from "../item-registry/item-registry.repository";
import { findAttemptFile } from "./attempt-file-answers";
import type { AttemptFileConfirmBody, AttemptFileUploadBody } from "./attempt-files.schemas";
import {
  answerFileInvalid,
  answerFileMissing,
  attemptNotFound,
  attemptNotInProgress,
  attemptTimeExpired,
  invalidAttemptItem,
} from "./attempts.errors";
import { attemptsRepository, parseAttemptMetadata, type AttemptRow } from "./attempts.repository";
import { attemptDeadlinePhase } from "./attempts.service";
import { itemsInAttempt, readPresentationOrder } from "./presentation-order";

/**
 * A learner's file for an upload question (QA review 1 m26; S3.4c). The
 * question used to take a typed file name and nothing else, so no grader ever
 * got a file. Now the file is uploaded to private storage the way course
 * images are: ask for an upload, send the bytes, confirm (the bytes are
 * checked against the type the extension names). The learner then saves it
 * as the answer, and a grader opens it from the grading task.
 */

type ServiceCtx = { tenantId: string; actorMembershipId: string; requestId: string };

export type AttemptFileBlobBody = { assetReferenceId: string; contentBuffer: Buffer };

/** The learner's own attempt, still open for answers. */
async function requireOpenAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
): Promise<AttemptRow> {
  const attempt = await attemptsRepository.findById(tx, attemptId);
  if (
    !attempt ||
    attempt.tenant_id !== ctx.tenantId ||
    attempt.membership_id !== ctx.actorMembershipId
  ) {
    throw attemptNotFound();
  }
  if (attempt.status !== "STARTED") throw attemptNotInProgress();
  if (attemptDeadlinePhase(parseAttemptMetadata(attempt.metadata_json)) === "closed") {
    throw attemptTimeExpired();
  }
  return attempt;
}

/** The upload question's rules, if the question is in this attempt. */
async function uploadQuestionRules(tx: TenantTx, attempt: AttemptRow, itemId: string) {
  const asked = itemsInAttempt(
    await assessmentsRepository.listAssessmentItems(tx, attempt.assessment_id),
    readPresentationOrder(parseAttemptMetadata(attempt.metadata_json).presentation),
  );
  if (!asked.some((row) => row.item_id === itemId)) throw invalidAttemptItem();
  const loaded = (await itemRegistryRepository.loadItemsWithOptions(tx, [itemId])).get(itemId);
  if (!loaded || loaded.item.item_type_key !== "file_upload") throw invalidAttemptItem();
  return answerFileRules(decodeExplanationJson(loaded.item.explanation_json).answerKeyJson);
}

function fileUnreadable(): AtlasHttpError {
  return answerFileInvalid(
    "This file couldn't be checked: it may be damaged, or not the kind of file its name says. Choose the file again.",
  );
}

export async function createAttemptFileUpload(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: AttemptFileUploadBody,
) {
  const attempt = await requireOpenAttempt(tx, ctx, attemptId);
  const rules = await uploadQuestionRules(tx, attempt, input.itemId);
  const problem = answerFileProblem(rules, input);
  if (problem) throw answerFileInvalid(problem);
  const extension = fileExtension(input.fileName);
  if (!isAnswerFileType(extension)) throw answerFileInvalid("Choose a file of an allowed type.");

  try {
    return await createSignedUpload(
      tx,
      { tenantId: ctx.tenantId },
      {
        purpose: "attempt.answer",
        resourceType: "attempt",
        resourceId: attemptId,
        fileName: input.fileName,
        contentType: ANSWER_FILE_TYPES[extension].contentType,
        sizeBytes: input.sizeBytes,
        visibility: "private",
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "ASSET_SIZE_LIMIT_EXCEEDED" ||
        error.message === "UNSUPPORTED_ATTEMPT_ANSWER_TYPE")
    ) {
      throw answerFileInvalid("This file can't be uploaded here. Choose another file.");
    }
    throw error;
  }
}

/** Local development only: the file arrives through the API instead of R2. */
export async function parseAttemptFileBlobRequest(req: NextRequest): Promise<AttemptFileBlobBody> {
  assertLocalBlobUpload();
  const assetReferenceId = z
    .uuid()
    .safeParse(req.headers.get("x-asset-reference-id")?.trim() ?? "");
  if (!assetReferenceId.success) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "X-Asset-Reference-Id must be a valid UUID.",
    });
  }
  const contentBuffer = await readLocalBlobBody(req);
  if (contentBuffer.byteLength === 0) throw answerFileInvalid("This file is empty.");
  return { assetReferenceId: assetReferenceId.data, contentBuffer };
}

export async function storeAttemptFileBlob(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: AttemptFileBlobBody,
) {
  assertLocalBlobUpload();
  await requireOpenAttempt(tx, ctx, attemptId);
  const asset = await findAttemptFile(tx, attemptId, input.assetReferenceId);
  if (!asset) throw answerFileMissing();
  if (asset.status !== "PENDING_UPLOAD") {
    throw answerFileInvalid("This file was already uploaded.");
  }

  const body = input.contentBuffer;
  assertAllowedSize({
    purpose: "attempt.answer",
    sizeBytes: body.byteLength,
    env: parseStorageEnv(process.env),
  });
  if (body.byteLength !== Number(asset.size_bytes)) {
    await updatePendingAssetReferenceSizeBytes(tx, input.assetReferenceId, body.byteLength);
  }
  await getStorageProvider().putObject({
    bucket: asset.bucket,
    key: asset.object_key,
    body,
    contentType: asset.content_type,
    contentDisposition: contentDispositionFor(asset.content_type, asset.file_name),
  });
  return { data: { assetReferenceId: input.assetReferenceId, stored: true as const } };
}

/** Checks the uploaded bytes; the file can then be saved as the answer. */
export async function confirmAttemptFile(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: AttemptFileConfirmBody,
) {
  await requireOpenAttempt(tx, ctx, attemptId);
  const asset = await findAttemptFile(tx, attemptId, input.assetReferenceId);
  if (!asset) throw answerFileMissing();

  let confirmed;
  try {
    confirmed = await confirmAssetUpload(
      tx,
      getStorageProvider(),
      { tenantId: ctx.tenantId },
      {
        assetReferenceId: asset.id,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ASSET_REFERENCE_NOT_FOUND") {
      throw answerFileMissing();
    }
    if (error instanceof Error && error.message.startsWith("ASSET_")) throw fileUnreadable();
    throw error;
  }

  return {
    data: {
      assetReferenceId: confirmed.data.id,
      fileName: confirmed.data.fileName,
      sizeBytes: confirmed.data.sizeBytes,
      contentType: confirmed.data.contentType,
    },
  };
}

async function signedFileLink(
  tx: TenantTx,
  ctx: { tenantId: string },
  attemptId: string,
  assetId: string,
) {
  const asset = await findAttemptFile(tx, attemptId, assetId);
  if (!asset || asset.status !== "READY") throw answerFileMissing();
  const link = await createSignedAssetDownload(tx, getStorageProvider(), ctx, {
    assetReferenceId: asset.id,
  });
  return { data: { ...link.data, fileName: asset.file_name } };
}

/** The learner opens a file they uploaded in their own attempt. */
export async function getOwnAttemptFile(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  assetId: string,
) {
  const attempt = await attemptsRepository.findById(tx, attemptId);
  if (
    !attempt ||
    attempt.tenant_id !== ctx.tenantId ||
    attempt.membership_id !== ctx.actorMembershipId
  ) {
    throw attemptNotFound();
  }
  return signedFileLink(tx, ctx, attemptId, assetId);
}

/** A grader opens a file in the attempt they're grading. */
export async function getGradingTaskFile(
  tx: TenantTx,
  ctx: ServiceCtx,
  taskId: string,
  assetId: string,
) {
  const task = await gradingRepository.findById(tx, taskId);
  if (!task || task.tenant_id !== ctx.tenantId) throw gradingTaskNotFound();
  return signedFileLink(tx, ctx, task.attempt_id, assetId);
}
