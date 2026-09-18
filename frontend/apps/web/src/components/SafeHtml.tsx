import { sanitizeHtml, type SafeHtmlVariant } from "@/lib/sanitize-html";

/**
 * The only sanctioned way to render author-supplied HTML.
 *
 * Raw `dangerouslySetInnerHTML` is banned by an ESLint rule everywhere except
 * this file and ThemeInitScript. See lib/sanitize-html.ts for why sanitisation
 * happens at render time rather than at save time.
 */

type SafeHtmlProps = {
  html: string | null | undefined;
  /** Defaults to a <div>; pass "span" for inline contexts. */
  as?: "div" | "span" | undefined;
  variant?: SafeHtmlVariant | undefined;
  className?: string | undefined;
  fallback?: string | undefined;
};

export function SafeHtml({
  html,
  as = "div",
  variant = "rich",
  className,
  fallback = "",
}: SafeHtmlProps) {
  const clean = sanitizeHtml(html ?? fallback, variant);
  const Tag = as;

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export { sanitizeHtml, type SafeHtmlVariant };
