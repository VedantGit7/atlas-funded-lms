import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalFilesystemStorageProvider } from "@atlas/storage/providers/local-filesystem-storage-provider";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import { R2StorageProvider } from "@atlas/storage/providers/r2-storage-provider";
import { StorageEnvSchema } from "@atlas/storage/schemas/storage-env";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";

type StreamingProvider = StorageProvider &
  Required<Pick<StorageProvider, "putObjectStream" | "getObjectStream">>;
type Request = { method: string; path: string; headers: Record<string, string>; body?: Readable };
const roots: string[] = [];
const identity = { bucket: "atlas-assets", key: "tenants/t1/exports/job/archive.zip" };
const contentType = "application/zip";
const requests: Request[] = [];
const requestSignals: (AbortSignal | undefined)[] = [];

async function bytes(stream: Readable | null | undefined): Promise<Buffer> {
  if (!stream) throw new Error("Expected object body");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

async function local() {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-export-provider-"));
  roots.push(root);
  return {
    root,
    provider: new LocalFilesystemStorageProvider(
      StorageEnvSchema.parse({ STORAGE_LOCAL_ROOT: root }),
    ),
  };
}

function r2(): StreamingProvider {
  const provider = new R2StorageProvider(
    StorageEnvSchema.parse({
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "contract-test",
      R2_ACCESS_KEY_ID: "fixture-access",
      R2_SECRET_ACCESS_KEY: "fixture-secret",
    }),
  );
  const objects = new Map<string, { body: Buffer; type: string }>();
  const client = (
    provider as unknown as {
      client: {
        config: {
          requestHandler: {
            handle: (request: Request, options?: { abortSignal?: AbortSignal }) => Promise<unknown>;
          };
        };
      };
    }
  ).client;
  vi.spyOn(client.config.requestHandler, "handle").mockImplementation(async (request, options) => {
    requests.push(request);
    requestSignals.push(options?.abortSignal);
    if (request.method === "PUT") {
      const body = await bytes(request.body);
      objects.set(request.path, { body, type: request.headers["content-type"] ?? "" });
      return {
        response: { statusCode: 200, headers: { etag: '"not-a-sha256"' }, body: Readable.from([]) },
      };
    }
    if (request.method === "DELETE") {
      objects.delete(request.path);
      return { response: { statusCode: 204, headers: {}, body: Readable.from([]) } };
    }
    const object = objects.get(request.path);
    return {
      response: object
        ? {
            statusCode: 200,
            headers: { "content-type": object.type, "content-length": String(object.body.length) },
            body: Readable.from(request.method === "HEAD" ? [] : [object.body]),
          }
        : {
            statusCode: 404,
            headers: {},
            body: Readable.from(["<Error><Code>NoSuchKey</Code></Error>"]),
          },
    };
  });
  return provider;
}

afterEach(async () => {
  vi.restoreAllMocks();
  requests.length = 0;
  requestSignals.length = 0;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

for (const name of ["local-fs", "local-mock", "r2"] as const) {
  describe(`${name} export stream contract`, () => {
    async function provider(): Promise<StreamingProvider> {
      return name === "local-fs"
        ? (await local()).provider
        : name === "r2"
          ? r2()
          : new LocalMockStorageProvider();
    }

    it("round trips the exact bytes and metadata, then deletes idempotently", async () => {
      const storage = await provider();
      const body = Buffer.from("PK\u0003\u0004binary\u0000archive");
      await storage.putObjectStream({
        ...identity,
        body: Readable.from([body.subarray(0, 4), body.subarray(4)]),
        sizeBytes: body.length,
        contentType,
      });
      expect(await bytes(await storage.getObjectStream(identity))).toEqual(body);
      expect(await storage.headObject(identity)).toMatchObject({
        contentType,
        sizeBytes: body.length,
      });
      await storage.deleteObject(identity);
      expect(await storage.getObjectStream(identity)).toBeNull();
      expect(await storage.headObject(identity)).toBeNull();
      await storage.deleteObject(identity);
      if (name === "r2") {
        const put = requests.find((request) => request.method === "PUT");
        if (!put) throw new Error("Expected upload request");
        expect(put.headers["content-length"]).toBe(String(body.length));
        expect(put.headers["content-encoding"] ?? "").not.toContain("aws-chunked");
        expect(put.headers["x-amz-trailer"]).toBeUndefined();
        expect(put.headers["x-amz-sdk-checksum-algorithm"]).toBeUndefined();
      }
    });

    it.each([2, 4])(
      "rejects a stream whose size differs from its declared %i bytes",
      async (sizeBytes) => {
        const storage = await provider();
        await expect(
          storage.putObjectStream({
            ...identity,
            body: Readable.from([Buffer.from("abc")]),
            sizeBytes,
            contentType,
          }),
        ).rejects.toThrow("STORAGE_STREAM_SIZE_MISMATCH");
        expect(await storage.getObjectStream(identity)).toBeNull();
      },
    );

    it("cancels a stalled source at the caller deadline", async () => {
      const storage = await provider();
      const source = new Readable({ read() {} });
      await expect(
        storage.putObjectStream({
          ...identity,
          body: source,
          sizeBytes: 10,
          contentType,
          signal: AbortSignal.timeout(25),
        }),
      ).rejects.toThrow();
      expect(source.destroyed).toBe(true);
      expect(await storage.getObjectStream(identity)).toBeNull();
    });

    it("rejects an already aborted read", async () => {
      const storage = await provider();
      await expect(
        storage.getObjectStream({ ...identity, signal: AbortSignal.abort() }),
      ).rejects.toThrow();
    });

    it("closes the source when upload was already cancelled", async () => {
      const storage = await provider();
      const source = new Readable({ read() {} });
      await expect(
        storage.putObjectStream({
          ...identity,
          body: source,
          sizeBytes: 0,
          contentType,
          signal: AbortSignal.abort(),
        }),
      ).rejects.toThrow();
      expect(source.destroyed).toBe(true);
    });

    it("cancels a read after returning its stream", async () => {
      const storage = await provider();
      await storage.putObjectStream({
        ...identity,
        body: Readable.from([Buffer.alloc(100)]),
        sizeBytes: 100,
        contentType,
      });
      const controller = new AbortController();
      const stream = await storage.getObjectStream({ ...identity, signal: controller.signal });
      const reading = bytes(stream);
      controller.abort();
      await expect(reading).rejects.toThrow();
    });

    it.each([-1, Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid declared size %s",
      async (sizeBytes) => {
        const storage = await provider();
        await expect(
          storage.putObjectStream({
            ...identity,
            body: Readable.from([]),
            sizeBytes,
            contentType,
          }),
        ).rejects.toThrow("STORAGE_STREAM_INVALID_SIZE");
      },
    );
  });
}

it("gives every R2 request a default deadline when no caller signal is supplied", async () => {
  const deadline = vi.spyOn(AbortSignal, "timeout");
  const provider = r2();
  await provider.putObjectStream({
    ...identity,
    body: Readable.from([Buffer.from("abc")]),
    sizeBytes: 3,
    contentType,
  });
  await provider.headObject(identity);
  await bytes(await provider.getObjectStream(identity));
  await provider.deleteObject(identity);
  expect(requestSignals).toHaveLength(4);
  expect(requestSignals.every((signal) => signal instanceof AbortSignal)).toBe(true);
  expect(deadline.mock.calls).toEqual([[30_000], [30_000], [30_000], [30_000]]);
});

describe("local filesystem export safety", () => {
  it("leaves the old object and no partial files after a failed replacement", async () => {
    const { provider } = await local();
    await provider.putObject({
      ...identity,
      body: Buffer.from("original"),
      contentType: "text/plain",
    });
    await expect(
      provider.putObjectStream({
        ...identity,
        body: Readable.from([Buffer.from("too long")]),
        sizeBytes: 2,
        contentType,
      }),
    ).rejects.toThrow();
    expect(await provider.getObjectBody(identity)).toEqual(Buffer.from("original"));
    expect(
      await readdir(path.dirname(provider.resolveObjectPath(identity.bucket, identity.key))),
    ).toEqual(["archive.zip", "archive.zip.meta.json"]);
  });

  it("cleans partial files after cancellation", async () => {
    const { root, provider } = await local();
    await expect(
      provider.putObjectStream({
        ...identity,
        body: new Readable({ read() {} }),
        sizeBytes: 2,
        contentType,
        signal: AbortSignal.timeout(25),
      }),
    ).rejects.toThrow();
    const files = await readdir(root, { recursive: true });
    expect(files.filter((file) => file.includes(".tmp") || file.endsWith("archive.zip"))).toEqual(
      [],
    );
  });

  it("rejects traversal across every new operation", async () => {
    const { provider } = await local();
    for (const bad of [
      { bucket: "atlas-assets", key: "../../escape" },
      { bucket: "C:", key: "escape" },
    ]) {
      await expect(provider.getObjectStream(bad)).rejects.toThrow("STORAGE_PATH_TRAVERSAL");
      await expect(
        provider.putObjectStream({ ...bad, body: Readable.from([]), sizeBytes: 0, contentType }),
      ).rejects.toThrow("STORAGE_PATH_TRAVERSAL");
    }
  });

  it("does not hide directory, corrupt metadata, or delete errors as missing objects", async () => {
    const { provider } = await local();
    const file = provider.resolveObjectPath(identity.bucket, identity.key);
    await mkdir(file, { recursive: true });
    await expect(provider.headObject(identity)).rejects.toThrow();
    await expect(provider.getObjectStream(identity)).rejects.toThrow();
    await expect(provider.deleteObject(identity)).rejects.toThrow();
    await rm(file, { recursive: true });
    await provider.putObject({ ...identity, body: Buffer.from("abc"), contentType });
    await writeFile(`${file}.meta.json`, "invalid json");
    await expect(provider.headObject(identity)).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe("abc");
  });
});
