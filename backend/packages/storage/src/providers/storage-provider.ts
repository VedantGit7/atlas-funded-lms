export type SignedUrlResult = {
  url: string;
  expiresAt: Date;
  requiredHeaders: Record<string, string>;
};

export type ObjectMetadata = {
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  etag?: string | null;
};

export type CreateSignedUploadUrlInput = {
  bucket: string;
  key: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  expiresInSeconds: number;
};

export type CreateSignedDownloadUrlInput = {
  bucket: string;
  key: string;
  expiresInSeconds: number;
};

export interface StorageProvider {
  createSignedUploadUrl(input: CreateSignedUploadUrlInput): Promise<SignedUrlResult>;
  createSignedDownloadUrl(
    input: CreateSignedDownloadUrlInput,
  ): Promise<Omit<SignedUrlResult, "requiredHeaders">>;
  headObject(input: { bucket: string; key: string }): Promise<ObjectMetadata | null>;
  getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null>;
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}
