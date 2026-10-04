/**
 * Response headers for served SCORM package content.
 *
 * Audit finding C1: package files (now `GET /api/v1/public/scorm/<capability>/<path>`) are
 * author-uploaded files with a `content-type` of `text/html`,
 * `application/javascript` or `image/svg+xml`, from the application's own
 * origin — the origin that holds the learner's session cookies. A content
 * author could therefore upload `evil.html` and run script in any learner's
 * session, escalating instructor → learner and instructor → tenant admin.
 *
 * SCORM content IS HTML and JavaScript, so it cannot be filtered. The fix is to
 * deny it access to the origin it is served from.
 *
 * `Content-Security-Policy: sandbox allow-scripts` does exactly that, per
 * response, with no infrastructure change: the browser loads the document into
 * an **opaque origin**. Scripts still run (SCORM needs them), but the document
 * cannot read or write cookies for the app origin, cannot touch localStorage,
 * cannot call same-origin APIs with credentials, and cannot reach the embedding
 * page. Crucially `allow-same-origin` is NOT granted — that single omission is
 * what makes the origin opaque, and adding it would undo the entire protection.
 *
 * A dedicated cookie-less content host is still preferable defence-in-depth and
 * remains open as an infrastructure decision, but it is no longer the only thing
 * standing between an uploaded package and a learner's session.
 */
export function scormContentSecurityHeaders(): Record<string, string> {
  return {
    // Opaque origin: scripts run, but with no access to the app origin.
    "content-security-policy": [
      "sandbox allow-scripts allow-forms allow-popups",
      "default-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
      "style-src 'self' 'unsafe-inline' data:",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "frame-ancestors 'self'",
    ].join("; "),
    // Permit the learner player to embed the package. Both Next apps must also
    // exempt this route from global DENY/CSP headers, which Next applies first.
    "x-frame-options": "SAMEORIGIN",
    // Never let the browser second-guess the declared type.
    "x-content-type-options": "nosniff",
    // Do not leak the tenant URL to anything the package contacts.
    "referrer-policy": "no-referrer",
  };
}
