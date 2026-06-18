import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
} from "./storage-provider";

export class LocalMockStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, ObjectMetadata>();

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

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    await Promise.resolve();
    this.objects.delete(`${input.bucket}/${input.key}`);
  }
}
