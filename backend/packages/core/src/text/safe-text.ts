/**
 * Plain text and link checks shared by request schemas. Also copied into
 * `@atlas/contracts` by `scripts/sync-contracts.mjs`, so it must stay
 * dependency-free.
 *
 * These replace one-pass cleaners that CodeQL flagged (js/incomplete-multi-
 * character-sanitization, js/incomplete-url-scheme-check). Removing a pattern
 * once can assemble a new one from what is left (`<scr<b>ipt>` becomes
 * `<script>`, `javajavascript:script:` becomes `javascript:`), and checking
 * that a link does not start with `javascript:` lets `data:`, `vbscript:` and
 * `java\tscript:` through, since browsers drop tabs and newlines in URLs.
 *
 * Text that reaches a page is still escaped where it is rendered; these keep
 * stored "plain text" plain, and stored links to the web.
 */

const SCRIPT_SCHEME = "javascript:";

/** A `<` before one of these can open a tag, comment, declaration or instruction. */
function opensMarkup(next: string | undefined): boolean {
  return next !== undefined && /[!/?a-zA-Z]/.test(next);
}

/** A `<` stays as text only before whitespace or a digit (`a < b`, `<5`). */
function isTextAfterLessThan(next: string | undefined): boolean {
  return next === undefined || /[\s0-9]/.test(next);
}

/**
 * Text with no markup, in one linear scan (no regex to backtrack, CodeQL
 * js/polynomial-redos). Whole tag spans (`<` before a tag character, up to the
 * next `>`) are skipped; any other `<` is kept only before whitespace or a
 * digit, so no kept `<` can start a tag; and `javascript:` is removed whenever
 * the output ends with it, so removal can never assemble a new one
 * (`javajavascript:script:`).
 */
export function toPlainText(value: string): string {
  // An array, not string concatenation: slicing a growing concatenated string
  // flattens it every time, which is quadratic again.
  const output: string[] = [];
  let index = 0;
  while (index < value.length) {
    const char = value.charAt(index);
    const next = index + 1 < value.length ? value.charAt(index + 1) : undefined;
    if (char === "<" && opensMarkup(next)) {
      const close = value.indexOf(">", index + 1);
      index = close === -1 ? value.length : close + 1;
      continue;
    }
    index += 1;
    if (char === "<" && !isTextAfterLessThan(next)) continue;
    output.push(char);
    if (endsWithScriptScheme(output)) output.length -= SCRIPT_SCHEME.length;
  }
  return output.join("").trim();
}

function endsWithScriptScheme(output: string[]): boolean {
  if (output.length < SCRIPT_SCHEME.length) return false;
  const start = output.length - SCRIPT_SCHEME.length;
  for (let offset = 0; offset < SCRIPT_SCHEME.length; offset += 1) {
    if (output[start + offset]?.toLowerCase() !== SCRIPT_SCHEME[offset]) return false;
  }
  return true;
}

/**
 * True for an absolute http(s) URL. The scheme is read the way a browser reads
 * it (the URL parser strips leading control characters and any tab or newline),
 * so `java\tscript:`, `data:` and `vbscript:` are all refused.
 */
export function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" || url.protocol === "http:";
}

/**
 * An http(s) URL, or a path on this site (`/brand/logo.svg`). `//host` and
 * `/\host` are refused: browsers resolve both to another site.
 */
export function isHttpUrlOrRootPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) {
    // Browsers drop tabs and newlines in URLs, so "/\t/host" would become "//host".
    return !/^\/[/\\]/.test(trimmed) && !/[\t\n\r]/.test(trimmed);
  }
  return isHttpUrl(trimmed);
}
