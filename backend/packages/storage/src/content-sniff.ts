/**
 * Check an uploaded object's bytes against the type it was declared as
 * (audit M8).
 *
 * The content type of an upload is whatever the client declared when it asked
 * for the signed URL; the signature binds the header, not the bytes. So an
 * HTML page or script could be stored as `image/png`, or a file of any kind as
 * `text/plain`. On finalize we read the first bytes and require them to be
 * what the declared type says: a magic number for binary formats, real text
 * that is not markup for text types, and an `<svg>` document for SVG.
 */

/** Enough for every signature below, and for a text check to be meaningful. */
export const SNIFF_BYTES = 4096;

export type SniffedKind =
  | "png"
  | "jpeg"
  | "webp"
  | "ico"
  | "gif"
  | "pdf"
  | "zip"
  | "ole"
  | "audio"
  | "svg"
  | "markup"
  | "text"
  | "binary";

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  head.length >= offset + bytes.length && bytes.every((byte, i) => head[offset + i] === byte);
const ascii = (head: Buffer, text: string, offset = 0) =>
  head.subarray(offset, offset + text.length).toString("latin1") === text;

function isAudio(head: Buffer): boolean {
  return (
    ascii(head, "ID3") || // MP3 with ID3 tag
    (head.length >= 2 && head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0) || // MPEG/ADTS frame
    (ascii(head, "RIFF") && ascii(head, "WAVE", 8)) ||
    ascii(head, "OggS") ||
    ascii(head, "fLaC") ||
    ascii(head, "ftyp", 4) || // MP4 / M4A / AAC container
    startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]) || // Matroska / WebM audio
    (ascii(head, "FORM") && (ascii(head, "AIFF", 8) || ascii(head, "AIFC", 8))) ||
    ascii(head, "#!AMR")
  );
}

const isUtf16 = (head: Buffer) => startsWith(head, [0xff, 0xfe]) || startsWith(head, [0xfe, 0xff]);

/** Text after any byte-order mark and leading whitespace, lowercased, for markup checks. */
function leadingText(head: Buffer): string {
  const sample = head.subarray(0, 2048);
  const decoded = startsWith(sample, [0xff, 0xfe])
    ? new TextDecoder("utf-16le").decode(sample)
    : startsWith(sample, [0xfe, 0xff])
      ? new TextDecoder("utf-16be").decode(sample)
      : sample.toString("utf8");
  return decoded
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
}

const MARKUP_STARTS = [
  "<!doctype html",
  "<html",
  "<head",
  "<body",
  "<script",
  "<iframe",
  "<object",
  "<embed",
  "<meta",
  "<link",
  "<style",
  "<a ",
  "<img",
  "<div",
  "<?xml",
  "<svg",
];

const LEADING_PROLOG =
  /^\s*(?:<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!doctype[^>[]*(?:\[[\s\S]*?\])?\s*>)/;

/**
 * The text after any leading XML prolog, comments and doctype. Removed one at a
 * time from the start until none is left, so a comment cannot hide the root
 * element from the checks below.
 */
function withoutLeadingProlog(text: string): string {
  let current = text;
  for (;;) {
    const next = current.replace(LEADING_PROLOG, "");
    if (next === current) return current.trimStart();
    current = next;
  }
}

function looksLikeText(head: Buffer): boolean {
  // UTF-16 text (some CSV exports) carries a byte-order mark and NUL bytes.
  if (isUtf16(head)) return true;
  for (const byte of head) {
    // NUL and most C0 controls never appear in text; tab, LF, CR, FF and ESC can.
    if (byte === 0 || (byte < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d, 0x1b].includes(byte))) {
      return false;
    }
  }
  return true;
}

export function sniffContent(head: Buffer): SniffedKind {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(head, "RIFF") && ascii(head, "WEBP", 8)) return "webp";
  if (ascii(head, "GIF87a") || ascii(head, "GIF89a")) return "gif";
  if (startsWith(head, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (head.subarray(0, 1024).includes("%PDF-")) return "pdf";
  if (
    startsWith(head, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(head, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(head, [0x50, 0x4b, 0x07, 0x08])
  )
    return "zip";
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  // Before audio: the UTF-16LE byte-order mark FF FE also matches an MPEG frame sync.
  if (!isUtf16(head) && isAudio(head)) return "audio";
  if (looksLikeText(head)) {
    const text = leadingText(head);
    const root = withoutLeadingProlog(text);
    if (root.startsWith("<svg")) return "svg";
    // A comment or prolog in front must not let markup pass as plain text.
    if (root !== text || MARKUP_STARTS.some((start) => root.startsWith(start))) return "markup";
    return "text";
  }
  return "binary";
}

/** What each declared type may actually contain. */
const EXPECTED: Record<string, readonly SniffedKind[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpeg"],
  "image/webp": ["webp"],
  // Modern .ico files may embed a PNG directly.
  "image/x-icon": ["ico", "png"],
  "image/vnd.microsoft.icon": ["ico", "png"],
  "image/svg+xml": ["svg"],
  "application/pdf": ["pdf"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/vnd.apple.pkpass": ["zip"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["zip"],
  "application/vnd.ms-powerpoint": ["ole"],
  "text/plain": ["text"],
  "text/csv": ["text"],
};

export class UploadContentMismatchError extends Error {
  constructor(
    readonly declared: string,
    readonly sniffed: SniffedKind,
  ) {
    super("ASSET_CONTENT_MISMATCH");
    this.name = "UploadContentMismatchError";
  }
}

/**
 * Throws UploadContentMismatchError unless `head` is consistent with the
 * declared type. Types without an entry (none are reachable from an upload
 * route today) must at least not be markup or SVG.
 */
export function assertContentMatchesDeclaredType(args: {
  declaredType: string;
  head: Buffer;
}): SniffedKind {
  const declared = args.declaredType.toLowerCase().split(";")[0]?.trim() ?? "";
  const sniffed = sniffContent(args.head);
  const expected = declared.startsWith("audio/") ? (["audio"] as const) : EXPECTED[declared];
  const allowed = expected ? expected.includes(sniffed) : sniffed !== "markup" && sniffed !== "svg";
  if (!allowed) throw new UploadContentMismatchError(declared, sniffed);
  return sniffed;
}
