import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StorageEnv } from "../schemas/storage-env";
import type {
  CreateSignedDownloadUrlInput,
  CreateSignedUploadUrlInput,
  ObjectMetadata,
  StorageProvider,
  GetObjectStreamInput,
  PutObjectStreamInput,
} from "./storage-provider";
import { boundedObjectStream } from "./bounded-object-stream";

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function removeIfPresent(file: string): Promise<void> {
  try {
    await unlink(file);
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

type StoredObjectMeta = {
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
};

function signDownloadToken(
  secret: string,
  bucket: string,
  key: string,
  expiresAtMs: number,
): string {
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
    // Local objects are runtime data, never build inputs. Without this marker,
    // Turbopack treats the configurable root as a dependency on the whole app.
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_ROOT);
    this.uploadTtlSeconds = env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS;
    this.downloadTtlSeconds = env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS;
    this.downloadBasePath = env.STORAGE_LOCAL_DOWNLOAD_BASE_PATH;
    this.publicOrigin = env.STORAGE_LOCAL_PUBLIC_ORIGIN;
    this.signingSecret = env.STORAGE_LOCAL_SIGNING_SECRET;
  }

  private objectPath(bucket: string, key: string): string {
    if (
      !bucket ||
      !/^[a-zA-Z0-9._-]+$/.test(bucket) ||
      bucket === "." ||
      bucket === ".." ||
      path.isAbsolute(key) ||
      key.split(/[\\/]/).includes("..")
    ) {
      throw new Error("STORAGE_PATH_TRAVERSAL");
    }
    const bucketRoot = path.resolve(this.root, bucket);
    const file = path.resolve(bucketRoot, key);
    if (!file.startsWith(`${bucketRoot}${path.sep}`)) throw new Error("STORAGE_PATH_TRAVERSAL");
    return file;
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
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  // The local-filesystem provider computes these synchronously; the interface
  // is async because the S3/R2 providers are. Promise.resolve keeps the shape
  // without pretending there is something to await.
  createSignedUploadUrl(input: CreateSignedUploadUrlInput) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const encodedKey = encodeURIComponent(input.key);

    return Promise.resolve({
      url: `http://localhost.local-storage/upload/${input.bucket}/${encodedKey}?expires=${String(expiresAt.getTime())}`,
      expiresAt,
      requiredHeaders: {
        "content-type": input.contentType,
      },
    });
  }

  createSignedDownloadUrl(input: CreateSignedDownloadUrlInput) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const expiresAtMs = expiresAt.getTime();
    const token = signDownloadToken(this.signingSecret, input.bucket, input.key, expiresAtMs);
    const params = new URLSearchParams({
      bucket: input.bucket,
      key: input.key,
      expires: String(expiresAtMs),
      token,
    });

    return Promise.resolve({
      url: `${this.publicOrigin}${this.downloadBasePath}?${params.toString()}`,
      expiresAt,
    });
  }

  async headObject(input: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    const filePath = this.objectPath(input.bucket, input.key);
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("STORAGE_OBJECT_NOT_FILE");
      const meta = await this.readMeta(input.bucket, input.key);
      return {
        contentType: meta?.contentType ?? "application/octet-stream",
        sizeBytes: fileStat.size,
        checksumSha256: meta?.checksumSha256 ?? null,
      };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async getObjectBody(input: { bucket: string; key: string }): Promise<Buffer | null> {
    try {
      return await readFile(this.objectPath(input.bucket, input.key));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.putObjectStream({
      ...input,
      sizeBytes: input.body.length,
      body: Readable.from([input.body]),
    });
  }

  async putObjectStream(input: PutObjectStreamInput): Promise<void> {
    if (input.signal?.aborted) input.body.destroy();
    input.signal?.throwIfAborted();
    const bounded = boundedObjectStream(input.sizeBytes);
    const file = this.objectPath(input.bucket, input.key);
    const temporary = `${file}.${randomUUID()}.tmp`;
    const temporaryMeta = `${temporary}.meta.json`;
    await this.ensureParentDir(file);
    try {
      await pipeline(input.body, bounded, createWriteStream(temporary, { flags: "wx" }), {
        signal: input.signal,
      });
      await writeFile(
        temporaryMeta,
        JSON.stringify({
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          checksumSha256: null,
        }),
        { flag: "wx", signal: input.signal },
      );
      input.signal?.throwIfAborted();
      await rename(temporary, file);
      await rename(temporaryMeta, this.metaPath(input.bucket, input.key));
    } finally {
      await Promise.all([removeIfPresent(temporary), removeIfPresent(temporaryMeta)]);
    }
  }

  async getObjectStream(input: GetObjectStreamInput): Promise<Readable | null> {
    input.signal?.throwIfAborted();
    const file = this.objectPath(input.bucket, input.key);
    try {
      const handle = await open(file, "r");
      try {
        if (!(await handle.stat()).isFile()) throw new Error("STORAGE_OBJECT_NOT_FILE");
        input.signal?.throwIfAborted();
        return handle.createReadStream({ signal: input.signal });
      } catch (error) {
        await handle.close();
        throw error;
      }
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    const filePath = this.objectPath(input.bucket, input.key);
    const metaFile = this.metaPath(input.bucket, input.key);
    await removeIfPresent(filePath);
    await removeIfPresent(metaFile);
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
