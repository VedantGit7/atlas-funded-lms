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
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveLaunchPath(manifestXml: string, entries: string[]): string {
  const manifestDir = entries.find((entry) => /imsmanifest\.xml$/i.test(entry));
  const baseDir = manifestDir ? normalizeZipPath(manifestDir).replace(/imsmanifest\.xml$/i, "") : "";

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

export function extractScormPackage(zipBuffer: Buffer): ExtractedScormPackage {
  const zip = new AdmZip(zipBuffer);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => normalizeZipPath(entry.entryName));

  const manifestEntry = zip
    .getEntries()
    .find((entry) => !entry.isDirectory && /imsmanifest\.xml$/i.test(entry.entryName));

  if (!manifestEntry) {
    throw new Error("SCORM_MANIFEST_NOT_FOUND");
  }

  const manifestXml = manifestEntry.getData().toString("utf8");
  const launchPath = resolveLaunchPath(manifestXml, entries);
  const scormVersion = detectScormVersion(manifestXml);

  const files = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => {
      const relativePath = normalizeZipPath(entry.entryName);
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

export function buildScormContentStorageKey(args: {
  tenantId: string;
  moduleId: string;
  relativePath: string;
}): string {
  const safePath = normalizeZipPath(args.relativePath).replace(/\.\.(\/|$)/g, "");
  return `tenants/${args.tenantId}/modules/${args.moduleId}/scorm/content/${safePath}`;
}
