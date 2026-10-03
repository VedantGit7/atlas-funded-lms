import { Transform } from "node:stream";

/** Reject before forwarding excess bytes; verify short input when the source ends. */
export function boundedObjectStream(sizeBytes: number): Transform {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error("STORAGE_STREAM_INVALID_SIZE");
  }
  let received = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > sizeBytes) {
        callback(new Error("STORAGE_STREAM_SIZE_MISMATCH"));
      } else {
        callback(null, chunk);
      }
    },
    flush(callback) {
      callback(received === sizeBytes ? null : new Error("STORAGE_STREAM_SIZE_MISMATCH"));
    },
  });
}
