import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";

/**
 * Where the payment gateway sends the learner afterwards (audit M4).
 *
 * The URLs are handed to Stripe or Razorpay as the post-payment redirect. Any
 * URL used to be accepted, which made the checkout an open redirect wearing
 * the payment provider's trusted page: a crafted link could finish a real
 * payment on an attacker's site. A return URL must now point at one of this
 * tenant's own active domains.
 *
 * Plain http and explicit ports are accepted only on development hostnames
 * (`*.localhost`, `*.test`), which no public domain can use.
 */
export type ReturnUrlField = "successUrl" | "cancelUrl";

function invalidReturnUrl(field: ReturnUrlField): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `${field} must be a page on this academy's own domain.`,
  });
}

function isDevelopmentHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".test");
}

export async function assertTenantReturnUrl(
  tx: TenantTx,
  value: string,
  field: ReturnUrlField,
): Promise<string> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidReturnUrl(field);
  }

  const hostname = url.hostname.toLowerCase();
  const development = isDevelopmentHostname(hostname);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && development)) {
    throw invalidReturnUrl(field);
  }
  if (url.username || url.password) {
    throw invalidReturnUrl(field);
  }
  if (url.port && !development) {
    throw invalidReturnUrl(field);
  }

  const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
    select exists (
      select 1
      from tenant_domains
      where tenant_id = app.current_tenant_id()
        and lower(hostname) = ${hostname}
        and status = 'ACTIVE'
        and deleted_at is null
    ) as ok
  `;
  if (!rows[0]?.ok) {
    throw invalidReturnUrl(field);
  }

  return url.toString();
}
