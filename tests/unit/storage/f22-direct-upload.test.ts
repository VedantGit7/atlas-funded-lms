import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
const post = vi.hoisted(() => vi.fn());
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { post },
  ClientApiError: class extends Error {},
}));
import { uploadLessonAssetFile } from "../../../frontend/apps/web/src/features/studio/courses/upload-lesson-asset";
import { uploadModuleScormPackage } from "../../../frontend/apps/web/src/features/studio/courses/upload-module-scorm-package";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  post.mockReset();
});
it.each(["lesson", "scorm"])(
  "sends a 6 MB %s File directly to the signed object URL without copying bytes into API requests",
  async (kind) => {
    const file = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      kind === "lesson" ? "lesson.pdf" : "course.zip",
      { type: kind === "lesson" ? "application/pdf" : "application/zip" },
    );
    const read = vi.spyOn(file, "arrayBuffer");
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    post
      .mockResolvedValueOnce({
        data: {
          asset: { id: "asset" },
          upload: {
            url: "https://bucket.r2.cloudflarestorage.com/signed",
            requiredHeaders: { "content-type": file.type },
          },
        },
      })
      .mockResolvedValueOnce({});
    if (kind === "lesson") await uploadLessonAssetFile("lesson", file, "lesson.asset");
    else await uploadModuleScormPackage("module", file);
    expect(read).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "https://bucket.r2.cloudflarestorage.com/signed",
      expect.objectContaining({ method: "PUT", body: file }),
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.every(([url]) => !String(url).endsWith("/blob"))).toBe(true);
  },
);
it("transfers a real 6 MB lesson upload over HTTP with matching length and digest", async () => {
  const file = new File([new Uint8Array(6 * 1024 * 1024).fill(71)], "lesson.pdf", {
    type: "application/pdf",
  });
  let received = 0;
  let digest = "";
  const server = createServer((request, response) => {
    const hash = createHash("sha256");
    request.on("data", (chunk: Buffer) => {
      received += chunk.length;
      hash.update(chunk);
    });
    request.on("end", () => {
      digest = hash.digest("hex");
      response.writeHead(200);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    post
      .mockResolvedValueOnce({
        data: {
          asset: { id: "asset" },
          upload: {
            url: `http://127.0.0.1:${address.port}/signed-object`,
            requiredHeaders: { "content-type": file.type },
          },
        },
      })
      .mockResolvedValueOnce({});
    await uploadLessonAssetFile("lesson", file, "lesson.asset");
    expect(received).toBe(file.size);
    expect(digest).toBe(
      createHash("sha256")
        .update(new Uint8Array(6 * 1024 * 1024).fill(71))
        .digest("hex"),
    );
    expect(post.mock.calls.every(([url]) => !String(url).endsWith("/blob"))).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
