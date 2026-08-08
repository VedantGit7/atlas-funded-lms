import { ClientApiError, clientApi } from "../../../lib/client-api";

const SCORM_ZIP_TYPES = new Set(["application/zip", "application/x-zip-compressed"]);

export function inferScormPackageContentType(file: File): string | null {
  const normalized = file.type.toLowerCase();
  if (SCORM_ZIP_TYPES.has(normalized)) {
    return normalized;
  }

  if (file.name.toLowerCase().endsWith(".zip")) {
    return "application/zip";
  }

  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

type SignedUploadResponse = {
  data: {
    asset: { id: string };
    upload: { url: string; requiredHeaders: Record<string, string> };
  };
};

export async function uploadModuleScormPackage(moduleId: string, file: File): Promise<void> {
  const contentType = inferScormPackageContentType(file);
  if (!contentType) {
    throw new ClientApiError(
      "VALIDATION_ERROR",
      400,
      "client",
      "SCORM packages must be uploaded as a .zip file.",
    );
  }

  const uploadResponse = await clientApi.post<SignedUploadResponse>(
    `/api/v1/modules/${moduleId}/scorm-package/upload`,
    {
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    },
    "module-scorm-upload",
  );

  const uploadUrl = uploadResponse.data.upload.url;
  if (uploadUrl.includes("localhost.local-storage")) {
    await clientApi.post(
      `/api/v1/modules/${moduleId}/scorm-package/blob`,
      {
        assetReferenceId: uploadResponse.data.asset.id,
        contentBase64: await fileToBase64(file),
      },
      "module-scorm-blob",
    );
  } else {
    const uploadResult = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadResponse.data.upload.requiredHeaders,
      body: file,
    });

    if (!uploadResult.ok) {
      throw new ClientApiError(
        "UPLOAD_FAILED",
        uploadResult.status,
        "client",
        "Failed to upload SCORM package. Please try again.",
      );
    }
  }

  await clientApi.post(
    `/api/v1/modules/${moduleId}/scorm-package/confirm`,
    { assetReferenceId: uploadResponse.data.asset.id },
    "module-scorm-confirm",
  );
}
