import DOMPurify from "isomorphic-dompurify";

/**
 * HTML sanitisation for author-supplied content.
 *
 * Audit finding H1: the repository contained **no HTML sanitizer at all** — no
 * DOMPurify, no sanitize-html, nothing — yet eight `dangerouslySetInnerHTML`
 * sites rendered author-controlled HTML, two of them on public unauthenticated
 * pages. Combined with the total absence of security headers (H2/C1) there was
 * no second line of defence.
 *
 * Sanitising at RENDER time rather than at save time is deliberate: rows already
 * stored are unsanitised, so a save-time-only fix would leave existing content
 * live. It also means a new write path cannot bypass sanitisation by forgetting
 * to call it.
 *
 * `isomorphic-dompurify` is used because these components render on the server
 * as well as the client.
 *
 * NOT covered here by design: marketing tracking snippets
 * (`marketing_integration_settings.site_body_html`) are deliberately arbitrary
 * script — the same trust model as Google Tag Manager. Those belong behind CSP
 * and a documented tenant-admin trust boundary, not behind a sanitizer that
 * would simply strip them.
 */

/** Rich text authored in the product: articles, newsfeed posts, email bodies. */
const RICH_TEXT_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel"],
  FORBID_TAGS: ["style", "form", "input", "button", "iframe", "object", "embed"],
  FORBID_ATTR: ["style", "formaction", "srcdoc"],
};

/** Small inline fragments: previews, thank-you messages, single paragraphs. */
const INLINE_CONFIG = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "br", "span", "p", "code"],
  ALLOWED_ATTR: ["href", "title", "target", "rel"],
};

/**
 * Inline SVG (the MFA enrolment QR code). Server-generated rather than
 * user-supplied, but SVG can carry `<script>` and event handlers, so it is
 * sanitised anyway rather than trusted by provenance.
 */
const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "foreignObject"],
  FORBID_ATTR: ["onload", "onerror", "onclick"],
};

export type SafeHtmlVariant = "rich" | "inline" | "svg";

const CONFIGS = {
  rich: RICH_TEXT_CONFIG,
  inline: INLINE_CONFIG,
  svg: SVG_CONFIG,
};

export function sanitizeHtml(html: string, variant: SafeHtmlVariant = "rich"): string {
  return DOMPurify.sanitize(html, CONFIGS[variant]);
}
