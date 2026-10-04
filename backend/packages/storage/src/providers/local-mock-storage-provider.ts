import { addAbortSignal, Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { boundedObjectStream } from "./bounded-object-stream";
import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
  GetObjectStreamInput,
  PutObjectStreamInput,
} from "./storage-provider";

export class LocalMockStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, ObjectMetadata>();
  private readonly bodies = new Map<string, Buffer>();

  async putObjectStream(input: PutObjectStreamInput): Promise<void> {
    if (input.signal?.aborted) input.body.destroy();
    input.signal?.throwIfAborted();
    const chunks: Buffer[] = [];
    await pipeline(
      input.body,
      boundedObjectStream(input.sizeBytes),
      new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      }),
      { signal: input.signal },
    );
    await this.putObject({ ...input, body: Buffer.concat(chunks, input.sizeBytes) });
  }

  async getObjectStream(input: GetObjectStreamInput): Promise<Readable | null> {
    input.signal?.throwIfAborted();
    const body = await this.getObjectBody(input);
    if (!body) return null;
    const stream = Readable.from([
      input.range ? body.subarray(input.range.start, input.range.end + 1) : body,
    ]);
    return input.signal ? addAbortSignal(input.signal, stream) : stream;
  }

  async createSignedUploadUrl(input: CreateSignedUploadUrlInput) {
    await Promise.resolve();
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const encodedKey = encodeURIComponent(input.key);

    this.objects.set(`${input.bucket}/${input.key}`, {
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256 ?? null,
    });

    return {
      url: `http://localhost.local-storage/upload/${input.bucket}/${encodedKey}?expires=${String(expiresAt.getTime())}`,
      expiresAt,
      requiredHeaders: {
        "content-type": input.contentType,
      },
    };
  }

  async createSignedDownloadUrl(input: CreateSignedDownloadUrlInput) {
    await Promise.resolve();
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const encodedKey = encodeURIComponent(input.key);

    return {
      url: `http://localhost.local-storage/download/${input.bucket}/${encodedKey}?expires=${String(expiresAt.getTime())}`,
      expiresAt,
    };
  }

  async headObject(input: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    await Promise.resolve();
    return this.objects.get(`${input.bucket}/${input.key}`) ?? null;
  }

  async getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null> {
    await Promise.resolve();
    return this.bodies.get(`${input.bucket}/${input.key}`) ?? null;
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await Promise.resolve();
    const objectKey = `${input.bucket}/${input.key}`;
    this.bodies.set(objectKey, input.body);
    this.objects.set(objectKey, {
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      checksumSha256: null,
    });
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    await Promise.resolve();
    const objectKey = `${input.bucket}/${input.key}`;
    this.objects.delete(objectKey);
    this.bodies.delete(objectKey);
  }
}
