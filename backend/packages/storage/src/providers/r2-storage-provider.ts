import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { addAbortSignal, Readable } from "node:stream";
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
import type { StorageEnv } from "../schemas/storage-env";

function requireR2Credential(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`R2 storage provider missing required env var: ${name}`);
  }

  return value;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(env: StorageEnv) {
    const accountId = requireR2Credential(env.R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
    const accessKeyId = requireR2Credential(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID");
    const secretAccessKey = requireR2Credential(env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY");

    this.client = new S3Client({
      region: "auto",
      // R2 does not implement every S3 checksum type. Keep uploads fixed-length;
      // export integrity is checked against downloaded bytes, never an ETag.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createSignedUploadUrl(input: CreateSignedUploadUrlInput) {
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      ChecksumSHA256: input.checksumSha256 ?? undefined,
      Metadata: {
        atlasManaged: "true",
      },
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      requiredHeaders: {
        "content-type": input.contentType,
      },
    };
  }

  async createSignedDownloadUrl(input: CreateSignedDownloadUrlInput) {
    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  async headObject(input: {
    bucket: string;
    key: string;
    signal?: AbortSignal;
  }): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
        { abortSignal: input.signal ?? AbortSignal.timeout(30_000) },
      );

      return {
        contentType: result.ContentType ?? "application/octet-stream",
        sizeBytes: result.ContentLength ?? 0,
        checksumSha256: result.ChecksumSHA256 ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (error instanceof Error && ["NotFound", "NoSuchKey"].includes(error.name)) return null;
      throw error;
    }
  }

  async getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
        { abortSignal: AbortSignal.timeout(30_000) },
      );

      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          atlasManaged: "true",
        },
      }),
      { abortSignal: AbortSignal.timeout(30_000) },
    );
  }

  async deleteObject(input: { bucket: string; key: string; signal?: AbortSignal }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
      { abortSignal: input.signal ?? AbortSignal.timeout(30_000) },
    );
  }

  async putObjectStream(input: PutObjectStreamInput): Promise<void> {
    const signal = input.signal ?? AbortSignal.timeout(30_000);
    if (signal.aborted) input.body.destroy();
    signal.throwIfAborted();
    const bounded = boundedObjectStream(input.sizeBytes);
    const pumping = pipeline(input.body, bounded, { signal });
    const uploading = this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: bounded,
        ContentLength: input.sizeBytes,
        ContentType: input.contentType,
        Metadata: { atlasManaged: "true" },
      }),
      { abortSignal: signal },
    );
    try {
      await Promise.all([pumping, uploading]);
    } catch (error) {
      input.body.destroy();
      bounded.destroy();
      await Promise.allSettled([pumping, uploading]);
      throw error;
    }
  }

  async getObjectStream(input: GetObjectStreamInput): Promise<Readable | null> {
    const signal = input.signal ?? AbortSignal.timeout(30_000);
    signal.throwIfAborted();
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ...(input.range
            ? { Range: `bytes=${String(input.range.start)}-${String(input.range.end)}` }
            : {}),
        }),
        { abortSignal: signal },
      );
      if (!result.Body) throw new Error("STORAGE_STREAM_BODY_MISSING");
      if (!(result.Body instanceof Readable)) throw new Error("STORAGE_STREAM_BODY_UNSUPPORTED");
      return addAbortSignal(signal, result.Body);
    } catch (error) {
      if (error instanceof Error && ["NoSuchKey", "NotFound"].includes(error.name)) return null;
      throw error;
    }
  }
}
