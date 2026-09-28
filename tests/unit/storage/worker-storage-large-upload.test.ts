import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { expect, it, vi } from "vitest";
import { StorageEnvSchema } from "@atlas/storage/schemas/storage-env";

const post = vi.hoisted(() => vi.fn());
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { post },
  ClientApiError: class extends Error {},
}));
import { uploadModuleScormPackage } from "../../../frontend/apps/web/src/features/studio/courses/upload-module-scorm-package";

function child(
  input: object,
  killAfterCheckpoint = false,
): Promise<{
  checkpoint?: string;
  key: string;
  result?: { launchPath: string; scormVersion: string };
  files?: Array<{ key: string; bytes: number; sha256: string }>;
  peakRssBytes: number;
  elapsedMs?: number;
}> {
  return new Promise((resolve, reject) => {
    const worker = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/reliability/worker-storage-child.mts"],
      {
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: "backend/apps/api/tsconfig.json",
          ATLAS_WORKER_STORAGE_FIXTURE: JSON.stringify(input),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "",
      errors = "",
      killed = false;
    const timeout = setTimeout(() => {
      worker.kill("SIGKILL");
      reject(new Error("Fixture child deadline"));
    }, 120_000);
    worker.stdout.on("data", (chunk) => {
      output += chunk;
      if (killAfterCheckpoint && output.includes("first-file-published") && !killed) {
        killed = true;
        worker.kill("SIGKILL");
      }
    });
    worker.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    worker.on("error", reject);
    worker.on("close", (code, signal) => {
      clearTimeout(timeout);
      if ((killAfterCheckpoint && killed) || code === 0) {
        try {
          resolve({
            ...JSON.parse(output.trim().split("\n").at(-1) ?? ""),
            exitCode: code,
            signal,
          });
        } catch {
          reject(new Error(`Invalid child output: ${output} ${errors}`));
        }
      } else reject(new Error(`Child ${code}: ${errors}`));
    });
  });
}

it.skipIf(process.env.ATLAS_RELIABILITY_DRILL !== "1")(
  "uploads the configured maximum ZIP and recovers processing in a fresh process",
  async () => {
    const base = path.resolve(".test-results/reliability");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, "worker-storage-"));
    const source = path.join(root, "received.zip");
    const max = StorageEnvSchema.parse({}).STORAGE_MAX_LESSON_ASSET_BYTES;
    const zip = new AdmZip();
    zip.addFile(
      "imsmanifest.xml",
      Buffer.from('<manifest><resource href="index.html"/></manifest>'),
    );
    zip.addFile("index.html", Buffer.from("<html>reliability fixture</html>"));
    for (let index = 0; index < 4; index++) {
      const name = `payload-${index}.bin`;
      zip.addFile(name, Buffer.alloc(24_999_000, 65 + index));
      const entry = zip.getEntry(name);
      if (!entry) throw new Error("Missing fixture entry");
      entry.header.method = 0;
    }
    let bytes = zip.toBuffer();
    zip.updateFile("payload-3.bin", Buffer.alloc(24_999_000 + max - bytes.length, 68));
    const lastEntry = zip.getEntry("payload-3.bin");
    if (!lastEntry) throw new Error("Missing fixture entry");
    lastEntry.header.method = 0;
    bytes = zip.toBuffer();
    expect(bytes.length).toBe(max);
    const expected = createHash("sha256").update(bytes).digest("hex");
    const file = new File([bytes], "maximum.zip", { type: "application/zip" });
    let received = 0,
      digest = "";
    const server = createServer(async (request, response) => {
      const hash = createHash("sha256");
      try {
        await pipeline(
          request,
          new Transform({
            transform(chunk, _encoding, callback) {
              received += chunk.length;
              hash.update(chunk);
              callback(null, chunk);
            },
          }),
          createWriteStream(source),
        );
        digest = hash.digest("hex");
        response.writeHead(200);
        response.end();
      } catch {
        response.destroy();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test port");
      post
        .mockResolvedValueOnce({
          data: {
            asset: { id: "fixture" },
            upload: {
              url: `http://127.0.0.1:${address.port}/signed-object`,
              requiredHeaders: { "content-type": file.type },
            },
          },
        })
        .mockResolvedValueOnce({});
      const uploadStart = performance.now();
      await uploadModuleScormPackage("fixture", file);
      const uploadMs = Math.round(performance.now() - uploadStart);
      expect(received).toBe(max);
      expect(digest).toBe(expected);
      expect(post.mock.calls.map(([url]) => url)).toEqual([
        "/api/v1/modules/fixture/scorm-package/upload",
        "/api/v1/modules/fixture/scorm-package/confirm",
      ]);
      const fixture = { root, source, bytes: max, tenant: randomUUID(), module: randomUUID() };
      const interrupted = await child(
        { ...fixture, version: "interrupted", interrupt: true },
        true,
      );
      expect(interrupted.checkpoint).toBe("first-file-published");
      const recovered = await child({ ...fixture, version: "recovered" });
      expect(recovered.result).toEqual({ launchPath: "index.html", scormVersion: "1.2" });
      expect(recovered.files).toHaveLength(6);
      expect(recovered.peakRssBytes).toBeLessThan(2 * 1024 ** 3);
      const orphan = path.join(root, "fixture", interrupted.key);
      expect((await readFile(orphan)).length).toBeGreaterThan(0);
      const evidence = {
        measuredAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        upload: {
          bytes: received,
          sha256: digest,
          elapsedMs: uploadMs,
          harnessPeakRssBytes: process.resourceUsage().maxRSS * 1024,
        },
        interrupted,
        recovered,
        orphanRemains: true,
        scope:
          "Loopback HTTP with mocked signing/confirmation; real production uploader/parser/local filesystem. Fresh processing child peak includes output digest rereads. No hosted runtime or R2 validation. Orphan cleanup is absent.",
      };
      await writeFile(
        path.join(base, "worker-storage-large-upload.json"),
        JSON.stringify(evidence, null, 2) + "\n",
      );
      console.log(JSON.stringify(evidence));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // Root was created by this test beneath the explicit fixture directory.
      if (path.dirname(root) === base) await rm(root, { recursive: true, force: true });
      post.mockReset();
    }
  },
  180_000,
);
