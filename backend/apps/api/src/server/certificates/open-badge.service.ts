/**
 * Open Badges 3.0 / Verifiable Credential builder + signer (pragmatic).
 *
 * `buildOpenBadgeCredential` returns a JSON-LD object shaped like an OB3
 * `AchievementCredential` (which is also a W3C Verifiable Credential). The
 * object is intentionally serialisable so it can be stored verbatim in the
 * `certificates.vc_json` column and served from the public open-badge route.
 *
 * `signCredentialEd25519` attaches an `Ed25519Signature2020`-style `proof`
 * using Node's native crypto. Ed25519 is a one-shot algorithm, so we call
 * `crypto.sign(null, message, key)` rather than `createSign`. When no key is
 * configured (via the `CERTIFICATE_ISSUER_PRIVATE_KEY` env var or an explicit
 * argument) the credential is returned unsigned and callers can persist the
 * unsigned VC — key injection can happen later without a data migration.
 */

import { createPrivateKey, sign as cryptoSign, type KeyObject } from "node:crypto";
import { enforceEntitlement } from "@atlas/authorization";
import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";

export type OpenBadgeCredentialInput = {
  issuerDid: string;
  issuerName: string;
  recipientName?: string | null;
  credentialId: string;
  courseTitle: string;
  issuedAt: string;
  expiresAt?: string | null;
  verificationUrl: string;
};

export type OpenBadgeCredential = {
  "@context": string[];
  id: string;
  type: string[];
  name: string;
  issuer: {
    id: string;
    type: string[];
    name: string;
  };
  validFrom: string;
  validUntil?: string;
  credentialSubject: {
    type: string[];
    name?: string;
    achievement: {
      id: string;
      type: string[];
      name: string;
      description: string;
      criteria: { narrative: string };
    };
  };
  proof?: OpenBadgeProof;
};

export type OpenBadgeProof = {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
};

const OB3_CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
];

export function buildOpenBadgeCredential(input: OpenBadgeCredentialInput): OpenBadgeCredential {
  const credential: OpenBadgeCredential = {
    "@context": OB3_CONTEXT,
    id: input.verificationUrl,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: input.courseTitle,
    issuer: {
      id: input.issuerDid,
      type: ["Profile"],
      name: input.issuerName,
    },
    validFrom: input.issuedAt,
    credentialSubject: {
      type: ["AchievementSubject"],
      ...(input.recipientName ? { name: input.recipientName } : {}),
      achievement: {
        id: `${input.verificationUrl}#achievement`,
        type: ["Achievement"],
        name: input.courseTitle,
        description: `Awarded by ${input.issuerName} for completing ${input.courseTitle}.`,
        criteria: {
          narrative: `Successfully completed the requirements for ${input.courseTitle}.`,
        },
      },
    },
  };

  if (input.expiresAt) {
    credential.validUntil = input.expiresAt;
  }

  return credential;
}

function resolveIssuerPrivateKey(privateKeyPem?: string | null): KeyObject | null {
  const pem = privateKeyPem ?? process.env["CERTIFICATE_ISSUER_PRIVATE_KEY"] ?? null;
  if (!pem) {
    return null;
  }

  try {
    const key = createPrivateKey({ key: pem, format: "pem" });
    if (key.asymmetricKeyType !== "ed25519") {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

/**
 * Deterministic serialisation used as the signing payload. This is a pragmatic
 * stand-in for full JSON-LD canonicalisation (URDNA2015): stable enough for a
 * self-hosted verifier that re-serialises the same object the same way.
 */
function canonicalize(credential: OpenBadgeCredential): string {
  const { proof: _proof, ...rest } = credential;
  return JSON.stringify(rest);
}

export function signCredentialEd25519(
  credential: OpenBadgeCredential,
  privateKeyPem?: string | null,
): OpenBadgeCredential {
  const key = resolveIssuerPrivateKey(privateKeyPem);
  if (!key) {
    // No issuer key configured — return the unsigned VC. Persist as-is and
    // inject a signature later once CERTIFICATE_ISSUER_PRIVATE_KEY is set.
    return credential;
  }

  const payload = Buffer.from(canonicalize(credential), "utf8");
  const signature = cryptoSign(null, payload, key);

  return {
    ...credential,
    proof: {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      verificationMethod: `${credential.issuer.id}#key-1`,
      proofPurpose: "assertionMethod",
      proofValue: signature.toString("base64url"),
    },
  };
}

export function isCredentialSigned(credential: OpenBadgeCredential): boolean {
  return credential.proof != null;
}

function resolveIssuerDid(): string {
  return process.env["CERTIFICATE_ISSUER_DID"] ?? "did:web:atlas-funded-lms";
}

/**
 * Public accessor for the open-badge route: returns the stored VC JSON when the
 * certificate was enriched at issue time, otherwise builds (and signs, when a
 * key is configured) a credential on the fly from the current row.
 */
export async function getPublicOpenBadgeCredential(args: {
  tx: TenantTx;
  tenantId: string;
  requestId: string;
  credentialId: string;
  verificationUrl: string;
}): Promise<OpenBadgeCredential | null> {
  await enforceEntitlement(args.tx, {
    tenantId: args.tenantId,
    key: "certification.enable",
    requestId: args.requestId,
  });

  const certificate = await certificateRepository.findCertificateByCredentialId(
    args.tx,
    args.tenantId,
    args.credentialId,
  );
  if (!certificate) {
    return null;
  }

  if (certificate.vc_json && typeof certificate.vc_json === "object") {
    return certificate.vc_json as OpenBadgeCredential;
  }

  const branding = await readRuntimeBrandingProjection(args.tx);
  return signCredentialEd25519(
    buildOpenBadgeCredential({
      issuerDid: resolveIssuerDid(),
      issuerName: branding.issuerName ?? branding.publicName ?? "Issuer",
      recipientName: certificate.recipient_name,
      credentialId: certificate.credential_id,
      courseTitle: certificate.course_title ?? "Certificate of completion",
      issuedAt: certificate.issued_at.toISOString(),
      ...(certificate.expires_at ? { expiresAt: certificate.expires_at.toISOString() } : {}),
      verificationUrl: args.verificationUrl,
    }),
  );
}
