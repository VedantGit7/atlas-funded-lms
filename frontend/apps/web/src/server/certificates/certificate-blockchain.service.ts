/**
 * Certificate blockchain anchoring (Tier 3).
 *
 * `anchorCertificateHash` computes a SHA-256 digest of the certificate's signed
 * VC JSON (falling back to the credential id) and stores it on the
 * `certificates.blockchain_anchor` column as a `sha256:<hex>` string. This is a
 * local anchor record — a real on-chain transaction is gated behind the
 * `CERTIFICATE_BLOCKCHAIN_ANCHOR` feature flag and can be layered on later
 * without changing the stored hash format.
 */

import { createHash } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";
import { certificateNotFound } from "./certificate.errors";
import type { ServiceCtx } from "./certificate.types";

export function isBlockchainAnchoringEnabled(): boolean {
  return process.env["CERTIFICATE_BLOCKCHAIN_ANCHOR"] === "true";
}

export function computeCertificateHash(input: { vcJson?: unknown; credentialId: string }): string {
  const source =
    input.vcJson != null ? JSON.stringify(input.vcJson) : input.credentialId;
  const digest = createHash("sha256").update(source, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export async function anchorCertificateHash(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<{ certificateId: string; anchor: string; onChain: boolean }> {
  const certificate = await certificateRepository.findCertificateById(tx, certificateId);
  if (!certificate || certificate.tenant_id !== ctx.tenantId) {
    throw certificateNotFound();
  }

  const anchor = computeCertificateHash({
    vcJson: certificate.vc_json,
    credentialId: certificate.credential_id,
  });

  let onChain = false;
  if (isBlockchainAnchoringEnabled()) {
    // TODO: submit `anchor` to the configured chain (e.g. an OP_RETURN / smart
    // contract write) and record the resulting transaction reference. Until a
    // provider is wired up we only persist the local hash.
    onChain = false;
  }

  await certificateRepository.updateBlockchainAnchor(tx, {
    certificateId: certificate.id,
    anchor,
  });

  return { certificateId: certificate.id, anchor, onChain };
}
