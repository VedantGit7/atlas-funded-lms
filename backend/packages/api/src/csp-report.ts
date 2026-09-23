import { AtlasHttpError } from "@atlas/core/http/errors";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS = 10;

function invalid(status = 400): never {
  throw new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status,
    message:
      status === 413
        ? "CSP report body exceeds the allowed size."
        : status === 415
          ? "Unsupported CSP report representation."
          : "Invalid CSP report.",
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function origin(value: unknown, required = false): string {
  if ((value === undefined || value === null || value === "") && !required) return "none";
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) invalid();
  if (["inline", "eval", "wasm-eval", "self", "none"].includes(value)) return value;
  if (/^data:/i.test(value)) return "data";
  if (/^blob:/i.test(value)) return "blob";
  try {
    const parsed = new URL(value);
    // Origins omit userinfo, paths, queries and fragments. All other schemes
    // become a fixed category, never browser-provided strings.
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin;
  } catch {
    // Relative, redacted and opaque browser locations carry no useful origin.
  }
  return "other";
}

function integer(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) invalid();
  return value;
}

function normalizeReport(value: unknown, modern: boolean) {
  const report = record(value);
  const read = (legacyName: string, modernName: string) => report[modern ? modernName : legacyName];
  let directive = read("effective-directive", "effectiveDirective");
  if (directive === undefined && !modern && typeof report["violated-directive"] === "string") {
    // Older legacy reports include the directive's policy value; retain only
    // the directive name and never persist the policy itself.
    directive = report["violated-directive"].split(/\s+/, 1)[0];
  }
  if (typeof directive !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(directive)) invalid();
  const disposition = report["disposition"] ?? "unknown";
  if (typeof disposition !== "string" || !["enforce", "report", "unknown"].includes(disposition))
    invalid();
  const statusCode = integer(read("status-code", "statusCode"), 599);
  const lineNumber = integer(read("line-number", "lineNumber"), 10_000_000);
  const columnNumber = integer(read("column-number", "columnNumber"), 10_000_000);
  return {
    documentOrigin: origin(read("document-uri", "documentURL"), true),
    blockedOrigin: origin(read("blocked-uri", "blockedURL")),
    sourceOrigin: origin(read("source-file", "sourceFile")),
    directive,
    disposition,
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(lineNumber === undefined ? {} : { lineNumber }),
    ...(columnNumber === undefined ? {} : { columnNumber }),
  };
}

/** Decode bounded untrusted browser telemetry; never return raw report fields. */
export async function readCspReports(req: Request) {
  const mediaType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (
    !["application/csp-report", "application/reports+json", "application/json"].includes(
      mediaType ?? "",
    )
  ) {
    invalid(415);
  }
  const encoding = req.headers.get("content-encoding")?.trim().toLowerCase();
  if (encoding && encoding !== "identity") invalid(415);
  const declaredLength = req.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) invalid();
    if (Number(declaredLength) > MAX_BODY_BYTES) invalid(413);
  }
  if (!req.body) invalid();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const deadlineController = new AbortController();
  const deadline = setTimeout(() => {
    deadlineController.abort();
    void reader.cancel().catch(() => undefined);
  }, 5_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        invalid(413);
      }
      if (value.byteLength) chunks.push(value);
    }
    if (deadlineController.signal.aborted) invalid(408);
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    invalid();
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    invalid();
  }

  if (mediaType === "application/reports+json" || Array.isArray(parsed)) {
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_REPORTS) invalid();
    // Normalize the entire batch before the caller emits any telemetry.
    return parsed.map((item: unknown) => {
      const envelope = record(item);
      if (envelope["type"] !== "csp-violation") invalid();
      return normalizeReport(envelope["body"], true);
    });
  }
  return [normalizeReport(record(parsed)["csp-report"], false)];
}
