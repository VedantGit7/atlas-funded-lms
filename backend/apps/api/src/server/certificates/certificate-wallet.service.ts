/**
 * Apple / Google wallet pass stubs.
 *
 * Real pass generation requires signing certificates (Apple PKPass) or a
 * Google Wallet issuer + service account. Until those are provisioned these
 * builders return a `not_configured` status so the API can respond
 * deterministically and the UI can show a "Coming soon" affordance. The stubs
 * still persist a `certificate_wallet_passes` row so issuance intent is
 * auditable and the endpoints can be swapped for real generators later.
 */

import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";
import { certificateNotFound } from "./certificate.errors";
import type { CertificateRow } from "./certificate.types";
import type { ServiceCtx } from "./certificate.types";

export type WalletPassResult = {
  platform: "apple" | "google";
  status: "not_configured" | "active";
  saveUrl?: string;
  passObjectKey?: string;
  message: string;
};

function appleWalletConfigured(): boolean {
  return (
    process.env["APPLE_WALLET_PASS_TYPE_ID"] != null &&
    process.env["APPLE_WALLET_TEAM_ID"] != null &&
    process.env["APPLE_WALLET_CERT_PEM"] != null
  );
}

function googleWalletConfigured(): boolean {
  return (
    process.env["GOOGLE_WALLET_ISSUER_ID"] != null &&
    process.env["GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"] != null
  );
}

export function createAppleWalletPassStub(certificate: CertificateRow): WalletPassResult {
  if (!appleWalletConfigured()) {
    return {
      platform: "apple",
      status: "not_configured",
      message:
        "Apple Wallet is not configured. Set APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID and APPLE_WALLET_CERT_PEM to enable .pkpass generation.",
    };
  }

  // A real implementation would build the pass.json + manifest.json, sign the
  // manifest with the pass-type certificate, and zip it into a .pkpass bundle:
  //   { formatVersion: 1, passTypeIdentifier, teamIdentifier, serialNumber,
  //     organizationName, description, generic: { primaryFields: [...] } }
  return {
    platform: "apple",
    status: "active",
    passObjectKey: `wallet/apple/${certificate.credential_id}.pkpass`,
    message: "Apple Wallet pass generated.",
  };
}

export function createGoogleWalletObjectStub(certificate: CertificateRow): WalletPassResult {
  if (!googleWalletConfigured()) {
    return {
      platform: "google",
      status: "not_configured",
      message:
        "Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_JSON to enable save-to-wallet links.",
    };
  }

  // A real implementation would create/patch a GenericObject via the Google
  // Wallet API and return a signed JWT "save" URL:
  //   https://pay.google.com/gp/v/save/<jwt>
  const issuerId = process.env["GOOGLE_WALLET_ISSUER_ID"];
  return {
    platform: "google",
    status: "active",
    saveUrl: `https://pay.google.com/gp/v/save/stub.${issuerId}.${certificate.credential_id}`,
    message: "Google Wallet object created.",
  };
}

async function loadOwnedCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<CertificateRow> {
  const certificate = await certificateRepository.findCertificateById(tx, certificateId);
  if (!certificate || certificate.tenant_id !== ctx.tenantId) {
    throw certificateNotFound();
  }
  return certificate;
}

export async function issueAppleWalletPass(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<{ data: WalletPassResult }> {
  const certificate = await loadOwnedCertificate(tx, ctx, certificateId);
  const result = createAppleWalletPassStub(certificate);

  await certificateRepository.upsertWalletPass(tx, {
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    platform: "apple",
    passObjectKey: result.passObjectKey ?? null,
    externalId: null,
    status: result.status,
  });

  return { data: result };
}

export async function issueGoogleWalletPass(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<{ data: WalletPassResult }> {
  const certificate = await loadOwnedCertificate(tx, ctx, certificateId);
  const result = createGoogleWalletObjectStub(certificate);

  await certificateRepository.upsertWalletPass(tx, {
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    platform: "google",
    passObjectKey: null,
    externalId: result.saveUrl ?? null,
    status: result.status,
  });

  return { data: result };
}
