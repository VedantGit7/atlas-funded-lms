import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
} from "./storage-provider";

export class LocalMockStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, ObjectMetadata>();
  private readonly bodies = new Map<string, Buffer>();

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
