import { ClientApiError, clientApi } from "../../../lib/client-api";
import { createUuid } from "../../../lib/create-uuid";
import type { ApiErrorBody } from "../../../lib/api/errors";

/**
 * A learner's file for an upload question (QA review 1 m26; S3.4c): ask for
 * an upload, send the file to storage, then confirm, which checks the bytes.
 * The confirmed file is then saved as the answer like any other.
 */

export type UploadedAnswerFile = {
  assetReferenceId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
};

type SignedUploadResponse = {
  data: {
    asset: { id: string };
    upload: { url: string; requiredHeaders: Record<string, string> };
  };
};

async function storeLocally(attemptId: string, assetReferenceId: string, file: File) {
  const response = await fetch(`/api/v1/attempts/${attemptId}/files/blob`, {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-asset-reference-id": assetReferenceId,
      "idempotency-key": `attempt-file-blob-${createUuid()}`,
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
    envelope?.error?.message ?? "The file couldn't be uploaded. Try again.",
  );
}

export async function uploadAttemptFile(
  attemptId: string,
  itemId: string,
  file: File,
): Promise<UploadedAnswerFile> {
  const upload = await clientApi.post<SignedUploadResponse>(
    `/api/v1/attempts/${attemptId}/files/upload`,
    { itemId, fileName: file.name, sizeBytes: file.size, contentType: file.type || undefined },
    "attempt-file-upload",
    { silent: true },
  );

  const uploadUrl = upload.data.upload.url;
  if (new URL(uploadUrl).hostname === "localhost.local-storage") {
    await storeLocally(attemptId, upload.data.asset.id, file);
  } else {
    // The type is the one the server chose from the extension (requiredHeaders).
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
        "The file couldn't be uploaded. Check your connection and try again.",
      );
    }
  }

  const confirmed = await clientApi.post<{ data: UploadedAnswerFile }>(
    `/api/v1/attempts/${attemptId}/files/confirm`,
    { assetReferenceId: upload.data.asset.id },
    "attempt-file-confirm",
    { silent: true },
  );
  return confirmed.data;
}

/**
 * Opens a file through a short-lived link (the learner's own, or a grader's).
 * The tab opens at the click, so pop-up blockers allow it, and goes to the
 * file once the link arrives.
 */
export async function openAnswerFile(path: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  try {
    const link = await clientApi.get<{ data: { url: string } }>(path);
    if (tab) {
      tab.opener = null;
      tab.location.href = link.data.url;
    } else {
      window.location.href = link.data.url;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
