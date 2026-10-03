import { addAbortSignal, type Readable } from "node:stream";
import {
  buildScormContentStorageKey,
  MAX_SCORM_ZIP_BYTES,
  openScormPackage,
} from "./scorm-package-extract";

/** Compressed input is capped at 100 MB; expanded output is consumed one <=25 MB file at a time. */
export async function publishScormPackage(input: {
  source: Readable;
  sizeBytes: number;
  tenantId: string;
  moduleId: string;
  contentVersion: string;
  signal?: AbortSignal;
  publish: (file: { key: string; body: Buffer; contentType: string }) => Promise<void>;
}) {
  const { source } = input;
  try {
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > MAX_SCORM_ZIP_BYTES
    )
      throw new Error("SCORM_ZIP_TOO_LARGE");
    if (input.signal) addAbortSignal(input.signal, source);
    // One allocation avoids a second compressed-package copy during Buffer.concat.
    const bytes = Buffer.allocUnsafe(input.sizeBytes);
    let received = 0;
    for await (const raw of source) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
      if (received + chunk.length > input.sizeBytes) throw new Error("SCORM_UPLOAD_SIZE_MISMATCH");
      chunk.copy(bytes, received);
      received += chunk.length;
    }
    if (received !== input.sizeBytes) throw new Error("SCORM_UPLOAD_SIZE_MISMATCH");
    const archive = openScormPackage(bytes);
    for (const file of archive.files) {
      input.signal?.throwIfAborted();
      await input.publish({
        key: buildScormContentStorageKey({ ...input, relativePath: file.relativePath }),
        body: file.content,
        contentType: file.contentType,
      });
    }
    return { launchPath: archive.launchPath, scormVersion: archive.scormVersion };
  } finally {
    source.destroy();
  }
}
