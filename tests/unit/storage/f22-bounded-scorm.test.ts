import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import { expect, it, vi } from "vitest";
import { publishScormPackage } from "@atlas/storage/scorm-package-publish";
import { assertLocalBlobUpload, readLocalBlobBody } from "@atlas/storage/local-blob-upload";
import {
  openScormPackage,
  MAX_SCORM_ENTRIES,
  MAX_SCORM_ENTRY_BYTES,
} from "@atlas/storage/scorm-package-extract";
function sample() {
  const zip = new AdmZip();
  zip.addFile("imsmanifest.xml", Buffer.from('<manifest><resource href="index.html"/></manifest>'));
  zip.addFile("index.html", Buffer.from("hello"));
  return zip.toBuffer();
}
function forgedStoredEntry(actualBytes: number) {
  const zip = new AdmZip(sample());
  zip.updateFile("index.html", Buffer.alloc(actualBytes, 65));
  const stored = zip.getEntry("index.html");
  if (!stored) throw new Error("Missing test entry");
  stored.header.method = 0;
  const bytes = zip.toBuffer();
  let offset = bytes.readUInt32LE(bytes.length - 6);
  while (bytes.readUInt32LE(offset) === 0x02014b50) {
    const nameLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (name === "index.html") bytes.writeUInt32LE(1, offset + 24);
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  return bytes;
}
it("bounds STORED data before reading even when its uncompressed size is forged", () => {
  expect(() => openScormPackage(forgedStoredEntry(MAX_SCORM_ENTRY_BYTES + 1))).toThrow(
    "SCORM_ENTRY_TOO_LARGE",
  );
});
it("rejects inconsistent STORED sizes instead of undercounting aggregate output", () => {
  expect(() => openScormPackage(forgedStoredEntry(100))).toThrow("SCORM_INVALID_ARCHIVE");
});
it("bounds the directory selected by the ZIP parser when ZIP64 overrides a forged classic count", () => {
  const zip = new AdmZip(sample());
  for (let i = 0; i < MAX_SCORM_ENTRIES; i++) zip.addFile(`directory-${i}/`, Buffer.alloc(0));
  const bytes = zip.toBuffer();
  const end = bytes.subarray(bytes.length - 22);
  const zip64 = Buffer.alloc(76);
  zip64.writeUInt32LE(0x06064b50, 0);
  zip64.writeBigUInt64LE(44n, 4);
  zip64.writeUInt16LE(45, 12);
  zip64.writeUInt16LE(45, 14);
  zip64.writeBigUInt64LE(BigInt(MAX_SCORM_ENTRIES + 2), 24);
  zip64.writeBigUInt64LE(BigInt(MAX_SCORM_ENTRIES + 2), 32);
  zip64.writeBigUInt64LE(BigInt(end.readUInt32LE(12)), 40);
  zip64.writeBigUInt64LE(BigInt(end.readUInt32LE(16)), 48);
  zip64.writeUInt32LE(0x07064b50, 56);
  zip64.writeBigUInt64LE(BigInt(bytes.length - 22), 64);
  zip64.writeUInt32LE(1, 72);
  end.writeUInt16LE(2, 8);
  end.writeUInt16LE(2, 10);
  const forged = Buffer.concat([bytes.subarray(0, bytes.length - 22), zip64, end]);
  expect(() => openScormPackage(forged)).toThrow("SCORM_INVALID_ARCHIVE");
});
it("bounds deep implicit directory metadata before indexing entries", () => {
  const zip = new AdmZip(sample());
  zip.addFile(`${"folder/".repeat(33)}file.txt`, Buffer.from("x"));
  expect(() => openScormPackage(zip.toBuffer())).toThrow("SCORM_INVALID_PATH");
});
it("bounds encoded path length before indexing entries", () => {
  const zip = new AdmZip(sample());
  zip.addFile(`${"x".repeat(1025)}.txt`, Buffer.from("x"));
  expect(() => openScormPackage(zip.toBuffer())).toThrow("SCORM_INVALID_PATH");
});
it("bounds directory entries before constructing the archive index", () => {
  const zip = new AdmZip(sample());
  for (let i = 0; i <= MAX_SCORM_ENTRIES; i++) zip.addFile(`directory-${i}/`, Buffer.alloc(0));
  expect(() => openScormPackage(zip.toBuffer())).toThrow("SCORM_TOO_MANY_ENTRIES");
});
it("rejects deployed blob fallbacks even with a local provider override", () => {
  expect(() =>
    assertLocalBlobUpload({ APP_ENV: "development", VERCEL: "1", STORAGE_PROVIDER: "local-fs" }),
  ).toThrow();
  expect(() => assertLocalBlobUpload({ APP_ENV: "development", STORAGE_PROVIDER: "r2" })).toThrow();
  expect(() =>
    assertLocalBlobUpload({ APP_ENV: "development", STORAGE_PROVIDER: "local-fs" }),
  ).not.toThrow();
});
it("rejects excess local body bytes during reading", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "12345" });
  await expect(readLocalBlobBody(request, 4, { APP_ENV: "test" })).rejects.toThrow();
});
it("preserves local development uploads above the deployed web body limit", async () => {
  const bytes = new Uint8Array(6 * 1024 * 1024).fill(41);
  const request = new Request("http://localhost", { method: "POST", body: bytes });
  const actual = await readLocalBlobBody(request, undefined, { APP_ENV: "development" });
  expect(actual.length).toBe(bytes.length);
  expect(actual[actual.length - 1]).toBe(41);
});
it("publishes one bounded entry at a time to a version-specific prefix", async () => {
  const bytes = sample();
  const put = vi.fn().mockResolvedValue(undefined);
  const result = await publishScormPackage({
    source: Readable.from([bytes]),
    sizeBytes: bytes.length,
    tenantId: "tenant",
    moduleId: "module",
    contentVersion: "version",
    publish: put,
  });
  expect(result.launchPath).toBe("index.html");
  expect(put).toHaveBeenCalledTimes(2);
  expect(put.mock.calls[0]?.[0].key).toContain("/content/version/");
});
it("rejects an oversized source before extracting or publishing", async () => {
  const source = Readable.from([Buffer.alloc(20), Buffer.alloc(20)]);
  const publish = vi.fn();
  await expect(
    publishScormPackage({
      source,
      sizeBytes: 20,
      tenantId: "t",
      moduleId: "m",
      contentVersion: "v",
      publish,
    }),
  ).rejects.toThrow("SCORM_UPLOAD_SIZE_MISMATCH");
  expect(publish).not.toHaveBeenCalled();
  expect(source.destroyed).toBe(true);
});
