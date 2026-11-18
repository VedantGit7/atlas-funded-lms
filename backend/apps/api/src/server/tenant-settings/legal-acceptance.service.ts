import type { TenantTx } from "@atlas/db";
import { readTenantLegalDocument } from "./tenant-legal.service";

/**
 * How a person agreed to the academy's Terms and Privacy Policy (launch plan
 * 5.7): the sign-up form, Google sign-up from the sign-up page, the join page
 * (signed in elsewhere, joining this academy), or an invitation.
 */
export type LegalAcceptanceSource = "signup" | "google_signup" | "join" | "invitation";

/** A person's "I agree", carried from where they ticked it to where the membership opens. */
export type LegalConsent = { source: LegalAcceptanceSource; acceptedAt: Date };

/**
 * The earliest an agreement can be dated. A sign-up link is valid for a day,
 * so an agreement carried by one is at most a day old; anything older, or in
 * the future, is not the person's tick from this sign-up.
 */
const MAX_CONSENT_AGE_MS = 25 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Turns a client-supplied ISO timestamp into a consent, or null if it isn't a plausible one. */
export function consentFrom(
  source: LegalAcceptanceSource,
  acceptedAt: string | null | undefined,
  now: Date = new Date(),
): LegalConsent | null {
  if (!acceptedAt) return null;
  const at = new Date(acceptedAt);
  const time = at.getTime();
  if (Number.isNaN(time)) return null;
  if (time > now.getTime() + CLOCK_SKEW_MS) return null;
  if (time < now.getTime() - MAX_CONSENT_AGE_MS) return null;
  return { source, acceptedAt: at };
}

/** The versions shown to the person: each document's "last updated" date, or null if unpublished. */
export async function readCurrentLegalVersions(
  tx: TenantTx,
): Promise<{ terms: string | null; privacy: string | null }> {
  const [terms, privacy] = await Promise.all([
    readTenantLegalDocument(tx, "terms"),
    readTenantLegalDocument(tx, "privacy"),
  ]);
  return { terms: terms?.lastUpdated ?? null, privacy: privacy?.lastUpdated ?? null };
}

export async function recordLegalAcceptance(
  tx: TenantTx,
  args: { tenantId: string; membershipId: string; consent: LegalConsent },
): Promise<void> {
  const versions = await readCurrentLegalVersions(tx);
  await tx.$executeRaw`
    insert into tenant_legal_acceptances
      (tenant_id, membership_id, source, terms_version, privacy_version, accepted_at)
    values (
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.consent.source},
      ${versions.terms},
      ${versions.privacy},
      ${args.consent.acceptedAt}
    )
  `;
}

export async function hasLegalAcceptance(
  tx: TenantTx,
  args: { tenantId: string; membershipId: string },
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ found: boolean }>>`
    select exists (
      select 1 from tenant_legal_acceptances
      where tenant_id = ${args.tenantId}::uuid and membership_id = ${args.membershipId}::uuid
    ) as found
  `;
  return rows[0]?.found === true;
}
