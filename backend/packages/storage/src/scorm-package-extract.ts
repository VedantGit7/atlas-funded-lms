import AdmZip from "adm-zip";

export type ScormVersion = "1.2" | "2004";

export type ExtractedScormPackage = {
  launchPath: string;
  scormVersion: ScormVersion;
  files: Array<{
    relativePath: string;
    content: Buffer;
    contentType: string;
  }>;
};

function detectScormVersion(manifestXml: string): ScormVersion {
  if (
    manifestXml.includes("adlnet.org/xsd/adlcp_v1p3") ||
    manifestXml.includes("2004") ||
    manifestXml.includes("CAM 1.3")
  ) {
    return "2004";
  }

  return "1.2";
}

function normalizeZipPath(path: string): string {
  const slashed = path.replace(/\\/g, "/").replace(/^\/+/, "");

  // Drop "." segments. SCORM manifests very commonly use href="./index.html",
  // which previously produced a launch path of "./index.html" that never matched
  // the extracted entry "index.html" — so those packages failed to upload with
  // SCORM_LAUNCH_FILE_NOT_FOUND. ".." is deliberately NOT collapsed here; it is
  // rejected outright by assertSafeRelativePath.
  const segments = slashed.split("/").filter((segment) => segment !== ".");

  return segments.join("/");
}

function resolveLaunchPath(manifestXml: string, entries: string[]): string {
  const manifestDir = entries.find((entry) => /imsmanifest\.xml$/i.test(entry));
  const baseDir = manifestDir
    ? normalizeZipPath(manifestDir).replace(/imsmanifest\.xml$/i, "")
    : "";

  const organizationItemRef = manifestXml.match(
    /<item[^>]*identifierref=["']([^"']+)["'][^>]*>/i,
  )?.[1];

  if (organizationItemRef) {
    const resourceBlock = manifestXml.match(
      new RegExp(
        `<resource[^>]*identifier=["']${organizationItemRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
        "i",
      ),
    )?.[0];

    const href = resourceBlock?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) {
      return normalizeZipPath(`${baseDir}${href}`);
    }
  }

  const fallbackHref = manifestXml.match(/<resource[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  if (fallbackHref) {
    return normalizeZipPath(`${baseDir}${fallbackHref}`);
  }

  const htmlEntry =
    entries.find((entry) => /index\.html?$/i.test(entry)) ??
    entries.find((entry) => /\.html?$/i.test(entry));

  if (!htmlEntry) {
    throw new Error("SCORM_LAUNCH_FILE_NOT_FOUND");
  }

  return normalizeZipPath(htmlEntry);
}

function guessContentType(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

/**
 * Decompression bounds.
 *
 * `assertAllowedSize` only limits the COMPRESSED upload
 * (STORAGE_MAX_LESSON_ASSET_BYTES, 100 MB by default). Without these caps a
 * 199.5 KB archive was measured expanding to 200 MB in memory — a ~1026x ratio —
 * so a permitted 100 MB upload could materialise ~100 GB and OOM the shared API
 * process, taking down every tenant on the instance.
 *
 * Limits are checked before getData(). Deflated output is capped by AdmZip at
 * the declared size; STORED entries allocate their compressed extent instead,
 * so both sizes must be bounded and consistent before reading them.
 */
export const MAX_SCORM_ENTRIES = 2_000;
export const MAX_SCORM_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_SCORM_TOTAL_BYTES = 250 * 1024 * 1024;
export const MAX_SCORM_ZIP_BYTES = 100 * 1024 * 1024;
export const MAX_SCORM_PATH_BYTES = 1_024;
export const MAX_SCORM_PATH_DEPTH = 32;

function assertWithinDecompressionLimits(entries: readonly AdmZip.IZipEntry[]): void {
  if (entries.length > MAX_SCORM_ENTRIES) {
    throw new Error("SCORM_TOO_MANY_ENTRIES");
  }

  let totalBytes = 0;

  for (const entry of entries) {
    const declaredSize = entry.header.size;
    const storedSize = entry.header.method === 0 ? entry.header.compressedSize : declaredSize;
    if (
      !Number.isSafeInteger(declaredSize) ||
      declaredSize < 0 ||
      !Number.isSafeInteger(storedSize) ||
      storedSize < 0
    )
      throw new Error("SCORM_INVALID_ARCHIVE");

    if (Math.max(declaredSize, storedSize) > MAX_SCORM_ENTRY_BYTES) {
      throw new Error("SCORM_ENTRY_TOO_LARGE");
    }
    if (storedSize !== declaredSize) throw new Error("SCORM_INVALID_ARCHIVE");

    totalBytes += declaredSize;

    if (totalBytes > MAX_SCORM_TOTAL_BYTES) {
      throw new Error("SCORM_PACKAGE_TOO_LARGE");
    }
  }
}

function readBoundedEntry(entry: AdmZip.IZipEntry): Buffer {
  const content = entry.getData();
  if (content.length > MAX_SCORM_ENTRY_BYTES) throw new Error("SCORM_ENTRY_TOO_LARGE");
  if (content.length !== entry.header.size) throw new Error("SCORM_INVALID_ARCHIVE");
  return content;
}

/** Validate metadata before AdmZip creates entries and implicit parent folders. */
function preflightDirectory(zipBuffer: Buffer): { end: number; count: number } {
  let end = -1;
  for (
    let offset = zipBuffer.length - 22;
    offset >= Math.max(0, zipBuffer.length - 65557);
    offset--
  ) {
    if (zipBuffer.readUInt32LE(offset) !== 0x06054b50) continue;
    if (offset + 22 + zipBuffer.readUInt16LE(offset + 20) !== zipBuffer.length) continue;
    end = offset;
    break;
  }
  if (end < 0) throw new Error("SCORM_INVALID_ARCHIVE");
  const count = zipBuffer.readUInt16LE(end + 10);
  if (count > MAX_SCORM_ENTRIES) throw new Error("SCORM_TOO_MANY_ENTRIES");
  let cursor = zipBuffer.readUInt32LE(end + 16);
  if (
    zipBuffer.readUInt16LE(end + 4) !== 0 ||
    zipBuffer.readUInt16LE(end + 6) !== 0 ||
    zipBuffer.readUInt16LE(end + 8) !== count ||
    cursor + zipBuffer.readUInt32LE(end + 12) !== end
  )
    throw new Error("SCORM_INVALID_ARCHIVE");
  // No ZIP64 or ambiguous alternate footer is supported. AdmZip scans these
  // preceding bytes even after finding a classic footer.
  for (let i = Math.max(0, end - 20); i < end; i++) {
    const signature = zipBuffer.readUInt32LE(i);
    if ([0x06054b50, 0x06064b50, 0x07064b50].includes(signature))
      throw new Error("SCORM_INVALID_ARCHIVE");
  }
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zipBuffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("SCORM_INVALID_ARCHIVE");
    const nameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const extraStart = nameStart + nameLength;
    const extraEnd = extraStart + extraLength;
    const next = extraEnd + commentLength;
    if (next > end || zipBuffer.readUInt16LE(cursor + 34) !== 0)
      throw new Error("SCORM_INVALID_ARCHIVE");
    if (nameLength < 1 || nameLength > MAX_SCORM_PATH_BYTES) throw new Error("SCORM_INVALID_PATH");
    const name = zipBuffer.subarray(nameStart, extraStart).toString("utf8").replace(/\\/g, "/");
    if (
      Buffer.byteLength(name, "utf8") > MAX_SCORM_PATH_BYTES ||
      name.split("/").length > MAX_SCORM_PATH_DEPTH
    )
      throw new Error("SCORM_INVALID_PATH");
    for (let extra = extraStart; extra < extraEnd; ) {
      if (extra + 4 > extraEnd) throw new Error("SCORM_INVALID_ARCHIVE");
      const field = zipBuffer.readUInt16LE(extra);
      const length = zipBuffer.readUInt16LE(extra + 2);
      if (field === 0x0001 || extra + 4 + length > extraEnd)
        throw new Error("SCORM_INVALID_ARCHIVE");
      extra += 4 + length;
    }
    cursor = next;
  }
  if (cursor !== end) throw new Error("SCORM_INVALID_ARCHIVE");
  return { end, count };
}

/** The worker consumes this iterator sequentially, retaining only one expanded entry. */
export function openScormPackage(zipBuffer: Buffer) {
  if (zipBuffer.length > MAX_SCORM_ZIP_BYTES) throw new Error("SCORM_ZIP_TOO_LARGE");
  const directory = preflightDirectory(zipBuffer);
  // Ignore archive comments so embedded footer signatures cannot redirect the
  // library away from the directory just validated. subarray adds no ZIP copy.
  const zip = new AdmZip(zipBuffer.subarray(0, directory.end + 22), { readEntries: false });
  if (zip.getEntryCount() !== directory.count) throw new Error("SCORM_INVALID_ARCHIVE");
  const fileEntries = zip.getEntries().filter((entry) => !entry.isDirectory);

  assertWithinDecompressionLimits(fileEntries);

  const entries = fileEntries.map((entry) => normalizeZipPath(entry.entryName));

  const manifestEntry = fileEntries.find((entry) => /imsmanifest\.xml$/i.test(entry.entryName));

  if (!manifestEntry) {
    throw new Error("SCORM_MANIFEST_NOT_FOUND");
  }

  const manifestXml = readBoundedEntry(manifestEntry).toString("utf8");
  const launchPath = resolveLaunchPath(manifestXml, entries);
  const scormVersion = detectScormVersion(manifestXml);

  for (const entry of fileEntries) assertSafeRelativePath(entry.entryName);
  if (new Set(entries).size !== entries.length) throw new Error("SCORM_DUPLICATE_PATH");
  if (!entries.includes(launchPath)) throw new Error("SCORM_LAUNCH_FILE_NOT_FOUND");
  function* files() {
    for (const entry of fileEntries) {
      const relativePath = normalizeZipPath(entry.entryName);
      // Reject traversal at extraction time too, not only when building storage
      // keys, so a crafted archive cannot smuggle a `..` segment downstream.
      assertSafeRelativePath(relativePath);
      yield {
        relativePath,
        content: readBoundedEntry(entry),
        contentType: guessContentType(relativePath),
      };
    }
  }

  return {
    launchPath,
    scormVersion,
    files: files(),
  };
}

export function extractScormPackage(zipBuffer: Buffer): ExtractedScormPackage {
  const opened = openScormPackage(zipBuffer);
  return { ...opened, files: [...opened.files] };
}

/**
 * Reject traversal rather than sanitise it.
 *
 * The previous guard was a single-pass `.replace(/\.\.(\/|$)/g, "")`, which is
 * bypassable by construction: removing the inner `../` from `....//x` leaves
 * `../x`. Three payloads were confirmed escaping the module prefix —
 * `....//secret`, `..././secret` and `....\/secret`. Any strip-based approach
 * invites the same class of bypass, so this validates and throws instead.
 */
export function assertSafeRelativePath(relativePath: string): string {
  const normalised = normalizeZipPath(relativePath);

  if (normalised.length === 0) {
    throw new Error("SCORM_INVALID_PATH");
  }

  // No leading-slash check here: normalizeZipPath already strips leading slashes,
  // so "/etc/passwd" arrives as "etc/passwd" and stays inside the module prefix.
  // A Windows drive letter survives normalisation, so it is rejected explicitly.
  if (/^[a-zA-Z]:/.test(normalised)) {
    throw new Error("SCORM_INVALID_PATH");
  }

  // "." segments are already removed by normalizeZipPath; ".." is the only
  // segment that can escape the prefix, and empty segments would produce a
  // non-canonical key.
  for (const segment of normalised.split("/")) {
    if (segment === ".." || segment === "") {
      throw new Error("SCORM_INVALID_PATH");
    }
  }

  return normalised;
}

export function buildScormContentStorageKey(args: {
  tenantId: string;
  moduleId: string;
  relativePath: string;
  contentVersion?: string | null;
}): string {
  const safePath = assertSafeRelativePath(args.relativePath);
  const version = args.contentVersion ? `${assertSafeRelativePath(args.contentVersion)}/` : "";
  return `tenants/${args.tenantId}/modules/${args.moduleId}/scorm/content/${version}${safePath}`;
}
