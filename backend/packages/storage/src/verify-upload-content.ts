import { createHash } from "node:crypto";
import { contentDispositionFor } from "./content-disposition";
import {
  SNIFF_BYTES,
  UploadContentMismatchError,
  assertContentMatchesDeclaredType,
} from "./content-sniff";
import type { StorageProvider } from "./providers/storage-provider";
import { SvgSanitizeError, sanitizeSvg } from "./svg-sanitize";

type UploadedObject = {
  bucket: string;
  object_key: string;
  content_type: string;
  file_name: string;
  size_bytes: number | bigint | string;
};

/** The first bytes of an object, without downloading all of it where the provider can range-read. */
async function readObjectHead(
  provider: StorageProvider,
  object: UploadedObject,
): Promise<Buffer | null> {
  const size = Number(object.size_bytes);
  if (size === 0) return Buffer.alloc(0);
  const location = { bucket: object.bucket, key: object.object_key };
  if (provider.getObjectStream) {
    const stream = await provider.getObjectStream({
      ...location,
      range: { start: 0, end: Math.min(SNIFF_BYTES, size) - 1 },
    });
    if (!stream) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks).subarray(0, SNIFF_BYTES);
  }
  const body = await provider.getObjectBody(location);
  return body ? body.subarray(0, SNIFF_BYTES) : null;
}

async function discard(provider: StorageProvider, object: UploadedObject) {
  try {
    await provider.deleteObject({ bucket: object.bucket, key: object.object_key });
  } catch {
    // The reference never becomes READY either way; a leftover object is unreachable.
  }
}

/**
 * Check an uploaded object's bytes before its reference is marked READY
 * (audit M8). Refuses (and deletes) an object whose content is not what it was
 * declared as. An SVG is sanitized and written back; the returned size and
 * checksum describe the stored, sanitized file.
 */
export async function verifyUploadedContent(
  provider: StorageProvider,
  object: UploadedObject,
): Promise<{ sizeBytes: number; checksumSha256: string } | null> {
  const head = await readObjectHead(provider, object);
  if (!head) throw new Error("ASSET_OBJECT_NOT_FOUND");

  let sniffed;
  try {
    sniffed = assertContentMatchesDeclaredType({ declaredType: object.content_type, head });
  } catch (error) {
    if (error instanceof UploadContentMismatchError) await discard(provider, object);
    throw error;
  }
  if (sniffed !== "svg") return null;

  const body = await provider.getObjectBody({ bucket: object.bucket, key: object.object_key });
  if (!body) throw new Error("ASSET_OBJECT_NOT_FOUND");
  let sanitized: Buffer;
  try {
    sanitized = await sanitizeSvg(body);
  } catch (error) {
    if (error instanceof SvgSanitizeError) await discard(provider, object);
    throw error;
  }
  await provider.putObject({
    bucket: object.bucket,
    key: object.object_key,
    body: sanitized,
    contentType: object.content_type,
    contentDisposition: contentDispositionFor(object.content_type, object.file_name),
  });
  return {
    sizeBytes: sanitized.byteLength,
    checksumSha256: createHash("sha256").update(sanitized).digest("hex"),
  };
}
