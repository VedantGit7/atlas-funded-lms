import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
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

  async headObject(input: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );

      return {
        contentType: result.ContentType ?? "application/octet-stream",
        sizeBytes: result.ContentLength ?? 0,
        checksumSha256: result.ChecksumSHA256 ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "NotFound") return null;
      throw error;
    }
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    );
  }
}
