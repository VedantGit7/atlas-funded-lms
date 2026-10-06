/**
 * The R2 bucket CORS policy browser uploads depend on (audit M8).
 *
 * Browsers PUT files straight to R2 with a presigned URL, from the tenant's own
 * host: an Atlas subdomain or a custom domain the tenant adds at any time. That
 * is a cross-origin request carrying the signed headers, so the browser first
 * sends a CORS preflight, and R2 answers it from the bucket's CORS rules. If a
 * signed header is missing from those rules, the preflight fails and the upload
 * never starts. That is how M8 could break uploads: signing
 * `content-disposition` made browsers send it, and a bucket whose rules listed
 * only `content-type` refused every SVG, text, CSV, ZIP and slide upload.
 *
 * So the headers are defined once, here: the presigner signs exactly
 * {@link SIGNED_UPLOAD_HEADERS} and the CORS rule allows exactly those, and
 * `pnpm storage:r2-cors` applies the rule and proves it with a real preflight.
 *
 * The rule allows any origin, deliberately. The presigned URL is the
 * credential: it names one key, one type, one disposition and expires in
 * minutes, and R2 receives no cookies or ambient authority from the browser.
 * An origin list would add nothing against a leaked URL (any HTTP client can
 * use one) and would break uploads on every custom domain added after the
 * list was written; keeping it in sync would need bucket-admin credentials in
 * the runtime. Only PUT is allowed: downloads are navigations and `<img>`
 * loads, which need no CORS.
 */

/** Request headers a browser sends with a presigned upload; all of them are signed. */
export const SIGNED_UPLOAD_HEADERS = ["content-type", "content-disposition"] as const;

/** The shape R2 (S3) uses for a bucket CORS rule. */
export type CorsRule = {
  ID?: string | undefined;
  AllowedOrigins?: string[] | undefined;
  AllowedMethods?: string[] | undefined;
  AllowedHeaders?: string[] | undefined;
  ExposeHeaders?: string[] | undefined;
  MaxAgeSeconds?: number | undefined;
};

/** A bucket's CORS rules, read and replaced as a whole. */
export type BucketCors = {
  /** The bucket's rules; an empty list when it has no CORS configuration. */
  get(): Promise<CorsRule[]>;
  put(rules: CorsRule[]): Promise<void>;
};

/** The rule Atlas manages: presigned browser uploads from any tenant host. */
export const UPLOAD_CORS_RULE: CorsRule = {
  AllowedOrigins: ["*"],
  AllowedMethods: ["PUT"],
  AllowedHeaders: [...SIGNED_UPLOAD_HEADERS],
  MaxAgeSeconds: 3600,
};

/** S3 patterns allow at most one `*`, matching any run of characters. */
function patternMatches(pattern: string, value: string, caseInsensitive: boolean): boolean {
  const [p, v] = caseInsensitive ? [pattern.toLowerCase(), value.toLowerCase()] : [pattern, value];
  const star = p.indexOf("*");
  if (star === -1) return p === v;
  const prefix = p.slice(0, star);
  const suffix = p.slice(star + 1);
  return v.length >= prefix.length + suffix.length && v.startsWith(prefix) && v.endsWith(suffix);
}

/**
 * The rule R2 would use to answer a preflight for a PUT from `origin` carrying
 * `headers`, or null if it would refuse it. As in S3, the first rule whose
 * origin and method match decides; every requested header must then be
 * allowed by that rule.
 */
export function matchingUploadRule(
  rules: readonly CorsRule[],
  origin: string,
  headers: readonly string[] = SIGNED_UPLOAD_HEADERS,
): CorsRule | null {
  for (const rule of rules) {
    const originOk = (rule.AllowedOrigins ?? []).some((pattern) =>
      patternMatches(pattern, origin, false),
    );
    const methodOk = (rule.AllowedMethods ?? []).some((method) => method.toUpperCase() === "PUT");
    if (!originOk || !methodOk) continue;
    const allowed = rule.AllowedHeaders ?? [];
    const headersOk = headers.every((header) =>
      allowed.some((pattern) => patternMatches(pattern, header, true)),
    );
    return headersOk ? rule : null;
  }
  return null;
}

export type UploadCorsPlan = {
  /** The configuration to write: the managed rule first, then the kept rules. */
  rules: CorsRule[];
  /** Existing rules that allow PUT, which the managed rule replaces. */
  replaced: CorsRule[];
  /** Existing rules for other methods (e.g. GET for a public bucket), kept as they are. */
  kept: CorsRule[];
  /** False when the bucket already holds exactly this configuration. */
  changed: boolean;
};

const normalize = (rules: readonly CorsRule[]) =>
  JSON.stringify(
    rules.map((rule) => ({
      AllowedOrigins: [...(rule.AllowedOrigins ?? [])].sort(),
      AllowedMethods: [...(rule.AllowedMethods ?? [])].map((m) => m.toUpperCase()).sort(),
      AllowedHeaders: [...(rule.AllowedHeaders ?? [])].map((h) => h.toLowerCase()).sort(),
      ExposeHeaders: [...(rule.ExposeHeaders ?? [])].map((h) => h.toLowerCase()).sort(),
      MaxAgeSeconds: rule.MaxAgeSeconds ?? null,
    })),
  );

/**
 * Plan the bucket configuration: replace every rule that allows PUT with the
 * managed rule, keep every other rule untouched. A put replaces the whole
 * configuration, so keeping them has to be explicit.
 */
export function planUploadCors(existing: readonly CorsRule[]): UploadCorsPlan {
  const allowsPut = (rule: CorsRule) =>
    (rule.AllowedMethods ?? []).some((method) => method.toUpperCase() === "PUT");
  const replaced = existing.filter(allowsPut);
  const kept = existing.filter((rule) => !allowsPut(rule));
  const rules = [UPLOAD_CORS_RULE, ...kept];
  return { rules, replaced, kept, changed: normalize(rules) !== normalize(existing) };
}

export type PreflightResult = {
  origin: string;
  ok: boolean;
  status: number | null;
  /** Why the browser would refuse the upload; absent when `ok`. */
  reason?: string;
};

/**
 * Send the preflight a browser sends before a presigned upload, and judge the
 * answer as the browser would. `url` should be a presigned upload URL, so the
 * request reaches exactly the host and path browsers use.
 */
export async function probeUploadPreflight(input: {
  url: string;
  origin: string;
  headers?: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<PreflightResult> {
  const headers = input.headers ?? SIGNED_UPLOAD_HEADERS;
  const doFetch = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(input.url, {
      method: "OPTIONS",
      headers: {
        origin: input.origin,
        "access-control-request-method": "PUT",
        "access-control-request-headers": headers.join(","),
      },
      signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
    });
  } catch (error) {
    return {
      origin: input.origin,
      ok: false,
      status: null,
      reason: `preflight request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const refuse = (reason: string): PreflightResult => ({
    origin: input.origin,
    ok: false,
    status: response.status,
    reason,
  });
  if (response.status < 200 || response.status >= 300) {
    return refuse(`preflight answered ${String(response.status)}`);
  }
  const allowOrigin = response.headers.get("access-control-allow-origin");
  if (allowOrigin !== "*" && allowOrigin !== input.origin) {
    return refuse(`Access-Control-Allow-Origin is ${allowOrigin ?? "missing"}`);
  }
  const allowMethods = (response.headers.get("access-control-allow-methods") ?? "")
    .split(",")
    .map((method) => method.trim().toUpperCase());
  if (!allowMethods.includes("PUT") && !allowMethods.includes("*")) {
    return refuse(`Access-Control-Allow-Methods does not include PUT`);
  }
  const allowHeaders = (response.headers.get("access-control-allow-headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase());
  const missing = headers.filter(
    (header) => !allowHeaders.includes(header.toLowerCase()) && !allowHeaders.includes("*"),
  );
  if (missing.length > 0) {
    return refuse(`Access-Control-Allow-Headers does not include ${missing.join(", ")}`);
  }
  return { origin: input.origin, ok: true, status: response.status };
}

/**
 * Origins to probe: the platform host, and a stand-in for a tenant custom
 * domain, which no configuration lists in advance.
 */
export function uploadProbeOrigins(platformHost: string | undefined): string[] {
  const origins = ["https://custom-domain.cors-probe.invalid"];
  const host = platformHost?.trim();
  if (host) origins.unshift(`https://${host}`);
  return origins;
}

/** A presigned upload URL for a key that is never written: the probe target. */
export const CORS_PROBE_KEY = "_atlas/cors-probe/upload-preflight";
