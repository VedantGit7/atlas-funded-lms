import type { TenantTx } from "@atlas/db";
import { findAssetReferenceById } from "@atlas/storage/asset-reference.repository";
import { answerFileProblem, answerFileRules } from "../item-registry/answer-rules.contract";
import { answerFileInvalid, answerFileMissing } from "./attempts.errors";
import type { AttemptFile } from "./attempt-files.schemas";

/**
 * An upload question's answer, checked (S3.4c): it must name a file this
 * attempt uploaded and confirmed, of a type and size the question allows.
 * What's stored comes from the file's own record, not from the browser.
 */
export async function canonicalFileAnswer(
  tx: TenantTx,
  args: { attemptId: string; answerJson: Record<string, unknown>; answerKey: unknown },
): Promise<AttemptFile> {
  const id = args.answerJson["assetReferenceId"];
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw answerFileMissing();

  const asset = await findAttemptFile(tx, args.attemptId, id);
  if (!asset || asset.status !== "READY") throw answerFileMissing();

  const file = {
    assetReferenceId: asset.id,
    fileName: asset.file_name,
    sizeBytes: Number(asset.size_bytes),
    contentType: asset.content_type,
  };
  const problem = answerFileProblem(answerFileRules(args.answerKey), file);
  if (problem) throw answerFileInvalid(problem);
  return file;
}

/** A file uploaded for this attempt (any status), or null. */
export async function findAttemptFile(tx: TenantTx, attemptId: string, assetReferenceId: string) {
  const asset = await findAssetReferenceById(tx, assetReferenceId);
  if (
    !asset ||
    asset.purpose !== "attempt.answer" ||
    asset.resource_type !== "attempt" ||
    asset.resource_id !== attemptId
  ) {
    return null;
  }
  return asset;
}
