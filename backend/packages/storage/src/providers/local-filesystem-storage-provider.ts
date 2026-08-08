import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageEnv } from "../schemas/storage-env";
import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
} from "./storage-provider";

type StoredObjectMeta = {
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
};

function signDownloadToken(secret: string, bucket: string, key: string, expiresAtMs: number): string {
  return createHmac("sha256", secret)
    .update(`${bucket}\n${key}\n${String(expiresAtMs)}`)
    .digest("hex");
}

export class LocalFilesystemStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly uploadTtlSeconds: number;
  private readonly downloadTtlSeconds: number;
  private readonly downloadBasePath: string;
  private readonly publicOrigin: string;
  private readonly signingSecret: string;

  constructor(env: StorageEnv) {
    this.root = path.resolve(process.cwd(), env.STORAGE_LOCAL_ROOT);
    this.uploadTtlSeconds = env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS;
    this.downloadTtlSeconds = env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS;
    this.downloadBasePath = env.STORAGE_LOCAL_DOWNLOAD_BASE_PATH;
    this.publicOrigin = env.STORAGE_LOCAL_PUBLIC_ORIGIN;
    this.signingSecret = env.STORAGE_LOCAL_SIGNING_SECRET;
  }

  private objectPath(bucket: string, key: string): string {
    return path.join(this.root, bucket, key);
  }

  private metaPath(bucket: string, key: string): string {
    return `${this.objectPath(bucket, key)}.meta.json`;
  }

  private async ensureParentDir(filePath: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  private async readMeta(bucket: string, key: string): Promise<StoredObjectMeta | null> {
    try {
      const raw = await readFile(this.metaPath(bucket, key), "utf8");
      return JSON.parse(raw) as StoredObjectMeta;
    } catch {
      return null;
    }
  }

  private async writeMeta(bucket: string, key: string, meta: StoredObjectMeta): Promise<void> {
    const metaFile = this.metaPath(bucket, key);
    await this.ensureParentDir(metaFile);
    await writeFile(metaFile, JSON.stringify(meta), "utf8");
  }

  async createSignedUploadUrl(input: CreateSignedUploadUrlInput) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const encodedKey = encodeURIComponent(input.key);

    return {
      url: `http://localhost.local-storage/upload/${input.bucket}/${encodedKey}?expires=${String(expiresAt.getTime())}`,
      expiresAt,
      requiredHeaders: {
        "content-type": input.contentType,
      },
    };
  }

  async createSignedDownloadUrl(input: CreateSignedDownloadUrlInput) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const expiresAtMs = expiresAt.getTime();
    const token = signDownloadToken(this.signingSecret, input.bucket, input.key, expiresAtMs);
    const params = new URLSearchParams({
      bucket: input.bucket,
      key: input.key,
      expires: String(expiresAtMs),
      token,
    });

    return {
      url: `${this.publicOrigin}${this.downloadBasePath}?${params.toString()}`,
      expiresAt,
    };
  }

  async headObject(input: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    const filePath = this.objectPath(input.bucket, input.key);
    try {
      const fileStat = await stat(filePath);
      const meta = await this.readMeta(input.bucket, input.key);
      return {
        contentType: meta?.contentType ?? "application/octet-stream",
        sizeBytes: Number(fileStat.size),
        checksumSha256: meta?.checksumSha256 ?? null,
      };
    } catch {
      return null;
    }
  }

  async getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null> {
    try {
      return await readFile(this.objectPath(input.bucket, input.key));
    } catch {
      return null;
    }
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const filePath = this.objectPath(input.bucket, input.key);
    await this.ensureParentDir(filePath);
    await writeFile(filePath, input.body);
    const existing = await this.readMeta(input.bucket, input.key);
    await this.writeMeta(input.bucket, input.key, {
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      checksumSha256: existing?.checksumSha256 ?? null,
    });
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    const filePath = this.objectPath(input.bucket, input.key);
    const metaFile = this.metaPath(input.bucket, input.key);
    await unlink(filePath).catch(() => undefined);
    await unlink(metaFile).catch(() => undefined);
  }

  verifyDownloadToken(args: {
    bucket: string;
    key: string;
    expiresAtMs: number;
    token: string;
  }): boolean {
    if (Date.now() > args.expiresAtMs) {
      return false;
    }

    const expected = signDownloadToken(this.signingSecret, args.bucket, args.key, args.expiresAtMs);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(args.token, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  resolveObjectPath(bucket: string, key: string): string {
    const filePath = this.objectPath(bucket, key);
    const resolvedRoot = path.resolve(this.root);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`) && resolvedFile !== resolvedRoot) {
      throw new Error("STORAGE_PATH_TRAVERSAL");
    }
    return resolvedFile;
  }

  async readMetaForDownload(bucket: string, key: string): Promise<StoredObjectMeta | null> {
    return this.readMeta(bucket, key);
  }
}

export function isLocalFilesystemUploadUrl(url: string): boolean {
  return url.includes("localhost.local-storage");
}
