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

const TAG = /<[^>]*>/g;
/** A `<` that could open a tag, comment, declaration or processing instruction. */
const TAG_OPENER = /<(?=[!/?a-z])/gi;
const SCRIPT_SCHEME = /javascript:/gi;

/**
 * Text with no markup: tags, anything that could open one, and `javascript:`
 * removed, repeatedly until nothing changes, so removal cannot assemble new
 * markup. A `<` before a space or digit (`a < b`, `<5`) is ordinary text and
 * stays.
 */
export function toPlainText(value: string): string {
  let current = value;
  for (;;) {
    const next = current.replace(TAG, "").replace(TAG_OPENER, "").replace(SCRIPT_SCHEME, "");
    if (next === current) return current.trim();
    current = next;
  }
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
