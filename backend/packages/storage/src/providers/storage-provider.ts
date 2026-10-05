export type SignedUrlResult = {
  url: string;
  expiresAt: Date;
  requiredHeaders: Record<string, string>;
};

export type ObjectMetadata = {
  contentType: string;
  contentDisposition?: string | null;
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
  /** Signed into the upload, so the stored object carries it (audit M8). */
  contentDisposition?: string | null;
  expiresInSeconds: number;
};

export type CreateSignedDownloadUrlInput = {
  bucket: string;
  key: string;
  expiresInSeconds: number;
  /** Response headers the signed URL forces, whatever the object was stored with (audit M8). */
  responseContentDisposition?: string | null;
  responseContentType?: string | null;
};

export interface StorageProvider {
  // Optional for compatibility with non-export adapters. Export workers require both.
  putObjectStream?(input: PutObjectStreamInput): Promise<void>;
  getObjectStream?(input: GetObjectStreamInput): Promise<Readable | null>;
  createSignedUploadUrl(input: CreateSignedUploadUrlInput): Promise<SignedUrlResult>;
  createSignedDownloadUrl(
    input: CreateSignedDownloadUrlInput,
  ): Promise<Omit<SignedUrlResult, "requiredHeaders">>;
  headObject(input: {
    bucket: string;
    key: string;
    signal?: AbortSignal;
  }): Promise<ObjectMetadata | null>;
  getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null>;
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
    contentDisposition?: string | null;
  }): Promise<void>;
  deleteObject(input: { bucket: string; key: string; signal?: AbortSignal }): Promise<void>;
}
import type { Readable } from "node:stream";

export type PutObjectStreamInput = {
  bucket: string;
  key: string;
  body: Readable;
  sizeBytes: number;
  contentType: string;
  /** Stored with the object; see content-disposition.ts (audit M8). */
  contentDisposition?: string | null;
  /** The caller can supply AbortSignal.timeout() to enforce its deadline. */
  signal?: AbortSignal;
};

export type GetObjectStreamInput = {
  bucket: string;
  key: string;
  signal?: AbortSignal;
  /** Inclusive byte offsets, already validated against the object's size by the caller. */
  range?: { start: number; end: number };
};
