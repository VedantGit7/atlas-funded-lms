import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";
import { AtlasHttpError } from "@atlas/core/http/errors";

export const MAX_LOCAL_BLOB_BYTES = 140 * 1024 * 1024;

/** Local convenience only: deployed bulk bytes must go straight to object storage. */
export function assertLocalBlobUpload(env: Record<string, string | undefined> = process.env) {
  if (isDeployedRuntime(env) || env["STORAGE_PROVIDER"] === "r2") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Upload this file directly using its signed storage URL.",
    });
  }
}

export async function readLocalBlobBody(
  request: Request,
  limit = MAX_LOCAL_BLOB_BYTES,
  env: Record<string, string | undefined> = process.env,
): Promise<Buffer> {
  assertLocalBlobUpload(env);
  const tooLarge = () =>
    new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 413,
      message: "Local request bodies are limited to 140 MB, including base64 encoding.",
    });
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally {
    reader.releaseLock();
  }
}
