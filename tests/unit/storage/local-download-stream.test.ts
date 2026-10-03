import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ valid: true, stream: vi.fn(), head: vi.fn() }));
vi.mock("@atlas/api", () => ({
  createPublicRouteHandler: (_metadata: unknown, handler: unknown) => handler,
}));
vi.mock("@atlas/storage", () => {
  class LocalFilesystemStorageProvider {
    verifyDownloadToken() {
      return mocks.valid;
    }
    headObject = mocks.head;
    getObjectStream = mocks.stream;
  }
  return {
    LocalFilesystemStorageProvider,
    parseStorageEnv: () => ({ STORAGE_PROVIDER: "local-fs" }),
  };
});
vi.mock("@atlas/storage/providers/storage-provider-factory", async () => {
  const { LocalFilesystemStorageProvider } = await import("@atlas/storage");
  return { createStorageProvider: () => new LocalFilesystemStorageProvider({} as never) };
});
import { GET } from "../../../..//backend/apps/api/src/app/api/v1/storage/local/download/route";
const get = GET as unknown as (ctx: { req: Request }) => Promise<Response>;
function req() {
  return new Request(
    "http://localhost/api/v1/storage/local/download?bucket=exports&key=test&expires=9999999999999&token=valid",
  );
}
describe("F15 local download streaming", () => {
  it("streams actual content with no browser cache and a byte length", async () => {
    mocks.valid = true;
    mocks.head.mockResolvedValue({ contentType: "application/json", sizeBytes: 7 });
    mocks.stream.mockResolvedValue(Readable.from([Buffer.from('{"a":1}')]));
    const request = req();
    const response = await get({ req: request });
    expect(await response.text()).toBe('{"a":1}');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-length")).toBe("7");
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ signal: request.signal }));
  });
  it("rejects invalid links before storage reads and reports missing files", async () => {
    mocks.valid = false;
    mocks.head.mockClear();
    await expect(get({ req: req() })).rejects.toMatchObject({ status: 403 });
    expect(mocks.head).not.toHaveBeenCalled();
    mocks.valid = true;
    mocks.head.mockResolvedValue(null);
    await expect(get({ req: req() })).rejects.toMatchObject({ status: 404 });
  });
});
