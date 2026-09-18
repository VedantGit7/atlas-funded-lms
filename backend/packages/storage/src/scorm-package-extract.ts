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
 * Limits are checked against each entry's DECLARED uncompressed size, before any
 * getData() call, so a bomb is rejected without ever being expanded.
 */
export const MAX_SCORM_ENTRIES = 2_000;
export const MAX_SCORM_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_SCORM_TOTAL_BYTES = 250 * 1024 * 1024;

function assertWithinDecompressionLimits(entries: readonly AdmZip.IZipEntry[]): void {
  if (entries.length > MAX_SCORM_ENTRIES) {
    throw new Error("SCORM_TOO_MANY_ENTRIES");
  }

  let totalBytes = 0;

  for (const entry of entries) {
    const declaredSize = entry.header.size;

    if (declaredSize > MAX_SCORM_ENTRY_BYTES) {
      throw new Error("SCORM_ENTRY_TOO_LARGE");
    }

    totalBytes += declaredSize;

    if (totalBytes > MAX_SCORM_TOTAL_BYTES) {
      throw new Error("SCORM_PACKAGE_TOO_LARGE");
    }
  }
}

export function extractScormPackage(zipBuffer: Buffer): ExtractedScormPackage {
  const zip = new AdmZip(zipBuffer);
  const fileEntries = zip.getEntries().filter((entry) => !entry.isDirectory);

  assertWithinDecompressionLimits(fileEntries);

  const entries = fileEntries.map((entry) => normalizeZipPath(entry.entryName));

  const manifestEntry = fileEntries.find((entry) => /imsmanifest\.xml$/i.test(entry.entryName));

  if (!manifestEntry) {
    throw new Error("SCORM_MANIFEST_NOT_FOUND");
  }

  const manifestXml = manifestEntry.getData().toString("utf8");
  const launchPath = resolveLaunchPath(manifestXml, entries);
  const scormVersion = detectScormVersion(manifestXml);

  const files = fileEntries.map((entry) => {
    const relativePath = normalizeZipPath(entry.entryName);
    // Reject traversal at extraction time too, not only when building storage
    // keys, so a crafted archive cannot smuggle a `..` segment downstream.
    assertSafeRelativePath(relativePath);
    return {
      relativePath,
      content: entry.getData(),
      contentType: guessContentType(relativePath),
    };
  });

  if (!files.some((file) => file.relativePath === launchPath)) {
    throw new Error("SCORM_LAUNCH_FILE_NOT_FOUND");
  }

  return {
    launchPath,
    scormVersion,
    files,
  };
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
}): string {
  const safePath = assertSafeRelativePath(args.relativePath);
  return `tenants/${args.tenantId}/modules/${args.moduleId}/scorm/content/${safePath}`;
}
