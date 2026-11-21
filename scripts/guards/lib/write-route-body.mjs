/**
 * Write routes must read their data from the request body.
 *
 * In `createTenantRoute`, `body:` parses the JSON body and `input:` parses the
 * URL query string. A POST, PUT, PATCH or DELETE that passed its body schema
 * as `input:` validated the (empty) query instead of what the client sent:
 * required fields failed with 400 "Invalid request" and optional ones were
 * silently dropped. Forty-four routes had that bug (QA review 2, C9 and
 * section 6), including batch, poll, live-session and custom-field creation.
 *
 * On a write method, `input:` is allowed only for a schema that really is a
 * query: `noBodySchema`, `emptyBodySchema`, or a schema named `*QuerySchema`.
 */

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const QUERY_SCHEMA = /^(noBodySchema|emptyBodySchema|[A-Za-z0-9_]*QuerySchema)$/;

/**
 * @param {string} source route.ts contents
 * @returns {Array<{ method: string, line: number, value: string }>}
 */
export function findWriteRoutesReadingQuery(source) {
  const lines = source.split(/\r?\n/);
  const findings = [];
  let method = null;

  lines.forEach((text, index) => {
    const start = /^export const (POST|PUT|PATCH|DELETE|GET|HEAD|OPTIONS)\s*=/.exec(text);
    if (start) {
      method = WRITE_METHODS.includes(start[1]) ? start[1] : null;
      return;
    }
    if (!method) return;
    if (/^\}\)?;?\s*$/.test(text)) {
      method = null;
      return;
    }
    // Only the route config's own top-level `input:` (two-space indent), not
    // an `input:` inside handler code.
    const input = /^ {2}input:\s*([^,]+?),?\s*$/.exec(text);
    if (input && !QUERY_SCHEMA.test(input[1].trim())) {
      findings.push({ method, line: index + 1, value: input[1].trim() });
    }
  });

  return findings;
}
