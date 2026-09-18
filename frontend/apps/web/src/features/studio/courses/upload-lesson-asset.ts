import { ClientApiError, clientApi } from "../../../lib/client-api";
import { createUuid } from "../../../lib/create-uuid";
import type { ApiErrorBody } from "../../../lib/api/errors";

type LessonAssetPurpose = "lesson.asset" | "lesson.attachment" | "lesson.thumbnail";

type SignedUploadResponse = {
  data: {
    asset: { id: string };
    upload: { url: string; requiredHeaders: Record<string, string> };
  };
};

function inferLessonAssetContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "pdf":
      return "application/pdf";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return file.type || "application/octet-stream";
  }
}

async function readFilePayload(file: File): Promise<{ bytes: ArrayBuffer; sizeBytes: number }> {
  const bytes = await file.arrayBuffer();
  return { bytes, sizeBytes: bytes.byteLength };
}

async function uploadLessonAssetBlob(
  lessonId: string,
  assetReferenceId: string,
  bytes: ArrayBuffer,
  contentType: string,
  purpose: LessonAssetPurpose,
): Promise<void> {
  const response = await fetch(`/api/v1/lessons/${lessonId}/assets/blob`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-asset-reference-id": assetReferenceId,
      "idempotency-key": `lesson-asset-blob-${purpose}-${createUuid()}`,
    },
    body: bytes,
    credentials: "same-origin",
  });

  const rawBody = await response.text();
  let body: unknown;

  try {
    body = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new ClientApiError(
      "INVALID_RESPONSE",
      response.status,
      createUuid(),
      response.status >= 500
        ? "The server returned an unexpected error. Check the API logs for details."
        : "Request failed.",
    );
  }

  if (!response.ok) {
    const envelope = body as ApiErrorBody;
    throw new ClientApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? createUuid(),
      envelope.error?.message ?? "Request failed.",
    );
  }
}

export async function uploadLessonAssetFile(
  lessonId: string,
  file: File,
  purpose: LessonAssetPurpose,
): Promise<string> {
  const contentType = inferLessonAssetContentType(file);
  const { bytes, sizeBytes } = await readFilePayload(file);

  const uploadResponse = await clientApi.post<SignedUploadResponse>(
    `/api/v1/lessons/${lessonId}/assets/upload`,
    {
      purpose,
      fileName: file.name,
      contentType,
      sizeBytes,
    },
    `lesson-asset-upload-${purpose}`,
  );

  const uploadUrl = uploadResponse.data.upload.url;
  if (uploadUrl.includes("localhost.local-storage")) {
    await uploadLessonAssetBlob(
      lessonId,
      uploadResponse.data.asset.id,
      bytes,
      contentType,
      purpose,
    );
  } else {
    const uploadResult = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadResponse.data.upload.requiredHeaders,
      body: bytes,
    });

    if (!uploadResult.ok) {
      throw new ClientApiError(
        "UPLOAD_FAILED",
        uploadResult.status,
        "client",
        "Failed to upload file. Please try again.",
      );
    }
  }

  await clientApi.post(
    `/api/v1/lessons/${lessonId}/assets/confirm`,
    { assetReferenceId: uploadResponse.data.asset.id },
    `lesson-asset-confirm-${purpose}`,
  );

  return uploadResponse.data.asset.id;
}

export async function attachLessonAssetReference(
  lessonId: string,
  assetReferenceId: string,
  assetType: string,
): Promise<void> {
  await clientApi.post(
    `/api/v1/lessons/${lessonId}/assets`,
    {
      assetType,
      provider: "r2",
      storageReferenceId: assetReferenceId,
    },
    "lesson-asset-attach-ref",
  );
}
