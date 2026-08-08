import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFilesystemStorageProvider } from "@atlas/storage/providers/local-filesystem-storage-provider";
import type { StorageEnv } from "@atlas/storage/schemas/storage-env";

function createEnv(root: string): StorageEnv {
  return {
    STORAGE_PROVIDER: "local-fs",
    STORAGE_LOCAL_ROOT: root,
    STORAGE_LOCAL_DOWNLOAD_BASE_PATH: "/api/v1/storage/local/download",
    STORAGE_LOCAL_SIGNING_SECRET: "test-local-storage-secret",
    R2_BUCKET_NAME: "atlas-assets",
    STORAGE_SIGNED_UPLOAD_TTL_SECONDS: 300,
    STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: 300,
    STORAGE_MAX_BRANDING_ASSET_BYTES: 2_000_000,
    STORAGE_MAX_LESSON_ASSET_BYTES: 100_000_000,
  };
}

describe("LocalFilesystemStorageProvider", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "atlas-storage-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("persists object across provider instances", async () => {
    const env = createEnv(root);
    const writer = new LocalFilesystemStorageProvider(env);
    await writer.putObject({
      bucket: "atlas-assets",
      key: "tenants/t1/lessons/l1/file.pdf",
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
    });

    const reader = new LocalFilesystemStorageProvider(env);
    const body = await reader.getObjectBody({
      bucket: "atlas-assets",
      key: "tenants/t1/lessons/l1/file.pdf",
    });

    expect(body?.toString()).toBe("pdf");
    const head = await reader.headObject({
      bucket: "atlas-assets",
      key: "tenants/t1/lessons/l1/file.pdf",
    });
    expect(head?.contentType).toBe("application/pdf");
    expect(head?.sizeBytes).toBe(3);
  });

  it("returns localhost.local-storage upload marker", async () => {
    const provider = new LocalFilesystemStorageProvider(createEnv(root));
    const upload = await provider.createSignedUploadUrl({
      bucket: "atlas-assets",
      key: "tenants/t1/test.png",
      contentType: "image/png",
      sizeBytes: 10,
      expiresInSeconds: 300,
    });

    expect(upload.url).toContain("localhost.local-storage/upload/");
  });

  it("issues signed download URLs and verifies token", async () => {
    const env = createEnv(root);
    const provider = new LocalFilesystemStorageProvider(env);
    const key = "tenants/t1/lessons/l1/file.pdf";
    await provider.putObject({
      bucket: "atlas-assets",
      key,
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
    });

    const signed = await provider.createSignedDownloadUrl({
      bucket: "atlas-assets",
      key,
      expiresInSeconds: 300,
    });

    expect(signed.url).toContain("/api/v1/storage/local/download?");
    const url = new URL(signed.url, "http://localhost");
    const token = url.searchParams.get("token");
    const expires = Number(url.searchParams.get("expires"));

    expect(
      provider.verifyDownloadToken({
        bucket: "atlas-assets",
        key,
        expiresAtMs: expires,
        token: token ?? "",
      }),
    ).toBe(true);
  });

  it("deletes objects from disk", async () => {
    const env = createEnv(root);
    const provider = new LocalFilesystemStorageProvider(env);
    const key = "tenants/t1/delete-me.txt";
    await provider.putObject({
      bucket: "atlas-assets",
      key,
      body: Buffer.from("gone"),
      contentType: "text/plain",
    });

    await provider.deleteObject({ bucket: "atlas-assets", key });
    expect(await provider.getObjectBody({ bucket: "atlas-assets", key })).toBeNull();
    await expect(readFile(provider.resolveObjectPath("atlas-assets", key))).rejects.toThrow();
  });
});
