import type { TenantTx } from "@atlas/db";
import {
  LegalDocumentSchema,
  type LegalDocument,
  type LegalDocumentSlug,
} from "@atlas/domain-branding/schemas/public-legal";

/**
 * Tenant legal documents, stored under `tenant_config.config_json.legal`.
 *
 * Terms and Privacy used to be module constants in the web app holding tenant
 * #1's text, so every academy served FundedBeyond's agreements from its own
 * domain. They are tenant configuration now: seeded per tenant from the tenant
 * manifest (`configs/tenants/<slug>/manifest.json`), and absent by default.
 *
 * Returning `null` for an unpublished document is deliberate and is the whole
 * point of the change — serving a placeholder, or another tenant's text, is
 * exactly the failure this replaces.
 */
export async function readTenantLegalDocument(
  tx: TenantTx,
  slug: LegalDocumentSlug,
): Promise<LegalDocument | null> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const root = rows[0]?.config_json;
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;

  const legal = (root as Record<string, unknown>)["legal"];
  if (!legal || typeof legal !== "object" || Array.isArray(legal)) return null;

  const candidate = (legal as Record<string, unknown>)[slug];
  if (candidate == null) return null;

  // Config is operator-supplied JSON, so validate rather than trust it. A
  // malformed document reads as "not published" instead of crashing a public
  // page or rendering half an agreement.
  const parsed = LegalDocumentSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.slug !== slug) return null;

  return parsed.data;
}
