/**
 * Shared security response headers for both Next apps.
 *
 * Audited state before this existed: a live probe of the running API returned
 * x-request-id, vary, cache-control, content-type, Date, Connection, Keep-Alive
 * and Transfer-Encoding — and not one security header. That absence is what
 * removed the second line of defence from both stored-XSS vectors (SCORM
 * content served as text/html from the app origin, and 8 unsanitised
 * dangerouslySetInnerHTML sites), and independently allowed clickjacking of
 * /admin and /studio plus MIME sniffing.
 *
 * CSP ships in Report-Only mode deliberately. Two things would break under
 * enforcement today:
 *
 *   1. components/ThemeInitScript.tsx renders an inline <script>, which
 *      `script-src 'self'` blocks. The fix is a nonce, not 'unsafe-inline' —
 *      'unsafe-inline' would defeat the entire point against the XSS vectors
 *      above.
 *   2. Proctoring calls getUserMedia({ video: true, audio: true }), so camera
 *      and microphone must stay permitted for same-origin.
 *
 * Collect report-only violations, fix the inline script with a nonce, then flip
 * CSP_ENFORCE=1 to enforce.
 */

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' is intentionally absent. See note 1 above.
  "script-src 'self'",
  // Tailwind and the tenant theme system inject style attributes at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Supabase, PostHog and Sentry are contacted from the browser.
  "connect-src 'self' https:",
  // Lesson video is provider-hosted (YouTube/Vimeo/Bunny), never self-hosted.
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const enforceCsp = process.env["CSP_ENFORCE"] === "1";

export const securityHeaders = [
  {
    key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value: CSP_DIRECTIVES,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Proctoring needs camera and microphone on the app's own origin.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** Next.js `headers()` entry applying the above to every route. */
export const securityHeadersRule = {
  source: "/:path*",
  headers: securityHeaders,
};
