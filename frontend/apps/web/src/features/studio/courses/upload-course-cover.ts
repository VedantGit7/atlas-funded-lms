import { ClientApiError, clientApi } from "../../../lib/client-api";
import { createUuid } from "../../../lib/create-uuid";
import type { ApiErrorBody } from "../../../lib/api/errors";

/** The image types the course image accepts (the API checks them too). */
export const COURSE_COVER_ACCEPT = "image/png,image/jpeg,image/webp";
export const COURSE_COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type SignedUploadResponse = {
  data: {
    asset: { id: string };
    upload: { url: string; requiredHeaders: Record<string, string> };
  };
};

type ConfirmResponse = { data: { assetReferenceId: string; coverKey: string } };

/** A message for a file the course image can't use, or null when it's fine. */
export function courseCoverFileProblem(file: File): string | null {
  if (!COURSE_COVER_TYPES.has(file.type)) return "Use a PNG, JPEG or WebP image.";
  if (file.size === 0) return "This file is empty. Choose another image.";
  return null;
}

async function storeLocally(courseId: string, assetReferenceId: string, file: File) {
  const response = await fetch(`/api/v1/courses/${courseId}/cover/blob`, {
    method: "POST",
    headers: {
      "content-type": file.type,
      "x-asset-reference-id": assetReferenceId,
      "idempotency-key": `course-cover-blob-${createUuid()}`,
    },
    body: file,
    credentials: "same-origin",
  });
  if (response.ok) return;
  const envelope = (await response.json().catch(() => null)) as ApiErrorBody | null;
  throw new ClientApiError(
    envelope?.error?.code ?? "UPLOAD_FAILED",
    response.status,
    envelope?.error?.requestId ?? createUuid(),
    envelope?.error?.message ?? "The image couldn't be uploaded. Try again.",
  );
}

/**
 * Uploads a course's image and makes it the course's image (QA review 1 M21,
 * M49): ask for an upload, send the file to storage, then confirm, which checks
 * the file and sets it on the course. Returns the image's lasting address.
 */
export async function uploadCourseCover(courseId: string, file: File): Promise<string> {
  const problem = courseCoverFileProblem(file);
  if (problem) throw new ClientApiError("VALIDATION_ERROR", 400, "client", problem);

  const upload = await clientApi.post<SignedUploadResponse>(
    `/api/v1/courses/${courseId}/cover/upload`,
    { fileName: file.name, contentType: file.type, sizeBytes: file.size },
    "course-cover-upload",
    { silent: true },
  );

  const uploadUrl = upload.data.upload.url;
  if (new URL(uploadUrl).hostname === "localhost.local-storage") {
    await storeLocally(courseId, upload.data.asset.id, file);
  } else {
    const stored = await fetch(uploadUrl, {
      method: "PUT",
      headers: upload.data.upload.requiredHeaders,
      body: file,
    });
    if (!stored.ok) {
      throw new ClientApiError(
        "UPLOAD_FAILED",
        stored.status,
        "client",
        "The image couldn't be uploaded. Try again.",
      );
    }
  }

  const confirmed = await clientApi.post<ConfirmResponse>(
    `/api/v1/courses/${courseId}/cover/confirm`,
    { assetReferenceId: upload.data.asset.id },
    "course-cover-confirm",
    { silent: true },
  );
  return confirmed.data.coverKey;
}
