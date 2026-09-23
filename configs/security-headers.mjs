/** Baseline headers only. Static CSP would override nonces and SCORM's sandbox. */
export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
export const securityHeadersRule = { source: "/:path*", headers: securityHeaders };
export const scormFramingHeadersRule = {
  source: "/api/v1/modules/:id/scorm-content",
  headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
};
export const formFramingHeadersRule = {
  source: "/f/:token",
  headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
};
export const CSP_REPORT_PATH = "/api/v1/public/security/csp-report";

function localDevelopment(env) {
  return (
    env.NODE_ENV === "development" &&
    ![env.APP_ENV, env.RELEASE_ENV, env.VERCEL_ENV].some((value) =>
      ["staging", "production", "preview"].includes(value),
    ) &&
    env.VERCEL !== "1"
  );
}

function configuredOrigins(env, name) {
  const raw = env[name]?.trim() ?? "";
  if (!raw) return [];
  const sources = raw.split(/[\s,]+/);
  if (sources.length > 32 || raw.length > 4096) throw new Error(`${name} has too many origins`);
  return sources.map((source) => {
    try {
      const url = new URL(source);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        /[*;'"\\]/.test(source)
      )
        throw new Error();
      return url.origin;
    } catch {
      throw new Error(`${name} must contain exact HTTPS origins only`);
    }
  });
}

function providerOrigin(env, name, { dsn = false } = {}) {
  const raw = env[name]?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" &&
        !(localDevelopment(env) && loopback && url.protocol === "http:")) ||
      (!dsn && (url.username || url.password)) ||
      /[*;'"\\\s]/.test(raw)
    )
      throw new Error();
    return [url.origin];
  } catch {
    throw new Error(`${name} must be a valid configured provider URL`);
  }
}

/** Tenant HTML and request headers never supply policy sources. */
export function buildDocumentCsp(nonce, env = process.env, { sameOriginFrame = false } = {}) {
  if (!/^[A-Za-z0-9+/]{24,}={0,2}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  if (env.CSP_ENFORCE && !["0", "1"].includes(env.CSP_ENFORCE))
    throw new Error("CSP_ENFORCE must be 0 or 1");
  const dev = localDevelopment(env);
  const supabase = providerOrigin(env, "NEXT_PUBLIC_SUPABASE_URL");
  const sentry = providerOrigin(env, "NEXT_PUBLIC_SENTRY_DSN", { dsn: true });
  const posthog = env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    ? providerOrigin(
        {
          ...env,
          NEXT_PUBLIC_POSTHOG_HOST:
            env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com",
        },
        "NEXT_PUBLIC_POSTHOG_HOST",
      )
    : [];
  const posthogAssets = posthog.flatMap((origin) => {
    if (origin === "https://eu.i.posthog.com") return ["https://eu-assets.i.posthog.com"];
    if (origin === "https://us.i.posthog.com") return ["https://us-assets.i.posthog.com"];
    return [];
  });
  const storage = providerOrigin(env, "R2_PUBLIC_ENDPOINT");
  if (env.R2_ACCOUNT_ID?.trim()) {
    if (!/^[a-zA-Z0-9-]+$/.test(env.R2_ACCOUNT_ID.trim()))
      throw new Error("Invalid R2_ACCOUNT_ID for CSP");
    storage.push(`https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`);
  }
  const directive = (name, sources) => `${name} ${[...new Set(sources)].join(" ")}`;
  const extra = (name) => configuredOrigins(env, name);
  return [
    "default-src 'self'",
    // No strict-dynamic: recreated scripts in tenant marketing HTML must not
    // inherit blanket trust. Dynamic loaders use explicit source origins.
    directive("script-src", [
      "'self'",
      `'nonce-${nonce}'`,
      "https://checkout.razorpay.com",
      ...posthogAssets,
      ...extra("CSP_SCRIPT_ORIGINS"),
      ...(dev ? ["'unsafe-eval'"] : []),
    ]),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    directive("img-src", [
      "'self'",
      "data:",
      "blob:",
      ...storage,
      ...supabase,
      ...posthog,
      ...extra("CSP_IMAGE_ORIGINS"),
    ]),
    directive("media-src", ["'self'", "blob:", ...storage, ...extra("CSP_MEDIA_ORIGINS")]),
    "font-src 'self' data:",
    directive("connect-src", [
      "'self'",
      ...supabase,
      ...supabase.map((origin) => origin.replace(/^http/, "ws")),
      ...sentry,
      ...posthog,
      ...posthogAssets,
      ...storage,
      "https://api.razorpay.com",
      ...extra("CSP_CONNECT_ORIGINS"),
      ...(dev ? ["ws:", "wss:"] : []),
    ]),
    directive("frame-src", [
      "'self'",
      "https://www.youtube.com",
      "https://player.vimeo.com",
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
      ...extra("CSP_FRAME_ORIGINS"),
    ]),
    `frame-ancestors ${sameOriginFrame ? "'self'" : "'none'"}`,
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
    `report-uri ${CSP_REPORT_PATH}`,
  ].join("; ");
}
