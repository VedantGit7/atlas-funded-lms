/**
 * Apple / Google Wallet pass issuance for certificates.
 *
 * Gated by CERTIFICATE_WALLETS=true. When platform credentials are missing the
 * service returns a deterministic `not_configured` payload (CI-safe, no throw).
 * When configured, Apple builds a signed .pkpass uploaded to R2; Google returns
 * a signed Save-to-Wallet JWT URL.
 */

import { createHash } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";
import { certificateNotFound } from "./certificate.errors";
import { isCertificateFeatureEnabled } from "./certificate-feature-flags";
import { APPLE_PKPASS_CONTENT_TYPE, storeCertificateWalletPass } from "./certificate-wallet-store";
import type { CertificateRow } from "./certificate.types";
import type { ServiceCtx } from "./certificate.types";

export type WalletPassResult = {
  platform: "apple" | "google";
  status: "not_configured" | "active";
  saveUrl?: string;
  downloadUrl?: string;
  passObjectKey?: string;
  message: string;
};

/** 1×1 transparent PNG used when no branding asset is available. */
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function envTrim(name: string): string | undefined {
  const value = process.env[name];
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function appleWalletConfigured(): boolean {
  return (
    envTrim("APPLE_WALLET_PASS_TYPE_ID") != null &&
    envTrim("APPLE_WALLET_TEAM_ID") != null &&
    envTrim("APPLE_WALLET_CERT_PEM") != null &&
    envTrim("APPLE_WALLET_KEY_PEM") != null &&
    envTrim("APPLE_WALLET_WWDR_PEM") != null
  );
}

function googleWalletConfigured(): boolean {
  return (
    envTrim("GOOGLE_WALLET_ISSUER_ID") != null &&
    envTrim("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") != null
  );
}

function resolveVerificationUrl(certificate: CertificateRow): string {
  const base = envTrim("CERTIFICATE_PUBLIC_BASE_URL")?.replace(/\/$/, "") ?? "";
  return `${base}/verify/${certificate.credential_id}`;
}

function sha1Hex(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex");
}

async function buildApplePkPass(certificate: CertificateRow): Promise<Buffer> {
  const passTypeId = envTrim("APPLE_WALLET_PASS_TYPE_ID");
  const teamId = envTrim("APPLE_WALLET_TEAM_ID");
  const certPem = envTrim("APPLE_WALLET_CERT_PEM");
  const keyPem = envTrim("APPLE_WALLET_KEY_PEM");
  const wwdrPem = envTrim("APPLE_WALLET_WWDR_PEM");
  if (
    passTypeId == null ||
    teamId == null ||
    certPem == null ||
    keyPem == null ||
    wwdrPem == null
  ) {
    throw new Error("Apple Wallet credentials are not configured.");
  }

  const organizationName = envTrim("APPLE_WALLET_ORGANIZATION_NAME") ?? "Atlas Certificates";
  const verifyUrl = resolveVerificationUrl(certificate);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    serialNumber: certificate.serial_number ?? certificate.credential_id,
    organizationName,
    description: certificate.course_title ?? "Certificate",
    logoText: organizationName,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(20, 20, 20)",
    labelColor: "rgb(200, 200, 200)",
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: verifyUrl,
        messageEncoding: "iso-8859-1",
      },
    ],
    generic: {
      primaryFields: [
        {
          key: "title",
          label: "CERTIFICATE",
          value: certificate.course_title ?? "Certificate of completion",
        },
      ],
      secondaryFields: [
        {
          key: "recipient",
          label: "RECIPIENT",
          value: certificate.recipient_name ?? "Learner",
        },
      ],
      auxiliaryFields: [
        {
          key: "credential",
          label: "CREDENTIAL ID",
          value: certificate.credential_id,
        },
      ],
      backFields: [
        {
          key: "verify",
          label: "Verify",
          value: verifyUrl,
        },
      ],
    },
  };

  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
    "icon.png": MINIMAL_PNG,
    "paula.r@example.org": MINIMAL_PNG,
    "logo.png": MINIMAL_PNG,
    "carol.w@example.org": MINIMAL_PNG,
  };

  const manifest: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    manifest[name] = sha1Hex(content);
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");
  files["manifest.json"] = manifestBuf;

  const forgeMod = await import("node-forge");
  const forge = forgeMod.default;
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const wwdr = forge.pki.certificateFromPem(wwdrPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuf.toString("binary"));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  // node-forge OID map is loosely typed; cast the signer payload for CMS detached sign.
  const oid = (name: string): string => {
    const value = (forge.pki.oids as Record<string, string | undefined>)[name];
    if (!value) throw new Error(`Missing forge OID: ${name}`);
    return value;
  };
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: oid("sha1"),
    authenticatedAttributes: [
      { type: oid("contentType"), value: oid("data") },
      { type: oid("messageDigest") },
      { type: oid("signingTime"), value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const signature = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  files["signature"] = signature;

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content, { compression: "STORE" });
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }));
}

async function buildGoogleSaveUrl(certificate: CertificateRow): Promise<{
  saveUrl: string;
  objectId: string;
}> {
  const issuerId = envTrim("GOOGLE_WALLET_ISSUER_ID");
  const saRaw = envTrim("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");
  if (issuerId == null || saRaw == null) {
    throw new Error("Google Wallet credentials are not configured.");
  }
  const sa = JSON.parse(saRaw) as {
    client_email: string;
    private_key: string;
  };

  const classId = envTrim("GOOGLE_WALLET_CLASS_ID") ?? `${issuerId}.certificate`;
  const objectId = `${issuerId}.${certificate.credential_id.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const verifyUrl = resolveVerificationUrl(certificate);

  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [] as string[],
    payload: {
      genericObjects: [
        {
          id: objectId,
          classId,
          cardTitle: {
            defaultValue: {
              language: "en-US",
              value: certificate.course_title ?? "Certificate",
            },
          },
          header: {
            defaultValue: {
              language: "en-US",
              value: certificate.recipient_name ?? "Learner",
            },
          },
          textModulesData: [
            {
              id: "credential",
              header: "Credential ID",
              body: certificate.credential_id,
            },
          ],
          barcode: {
            type: "QR_CODE",
            value: verifyUrl,
          },
          hexBackgroundColor: "#141414",
        },
      ],
    },
  };

  const { SignJWT, importPKCS8 } = await import("jose");
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .sign(privateKey);

  return {
    saveUrl: `https://pay.google.com/gp/v/save/${jwt}`,
    objectId,
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
  if (!isCertificateFeatureEnabled("wallets")) {
    return {
      data: {
        platform: "apple",
        status: "not_configured",
        message: "WALLET_FEATURE_DISABLED",
      },
    };
  }

  const certificate = await loadOwnedCertificate(tx, ctx, certificateId);

  if (!appleWalletConfigured()) {
    const result: WalletPassResult = {
      platform: "apple",
      status: "not_configured",
      message:
        "Apple Wallet is not configured. Set APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID, APPLE_WALLET_CERT_PEM, APPLE_WALLET_KEY_PEM and APPLE_WALLET_WWDR_PEM.",
    };
    await certificateRepository.upsertWalletPass(tx, {
      tenantId: ctx.tenantId,
      certificateId: certificate.id,
      platform: "apple",
      passObjectKey: null,
      externalId: null,
      status: result.status,
    });
    return { data: result };
  }

  const pkpass = await buildApplePkPass(certificate);
  const { objectKey } = await storeCertificateWalletPass({
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    content: pkpass,
  });

  const downloadUrl = `/api/v1/certificates/${certificate.id}/wallet/apple/download`;
  const result: WalletPassResult = {
    platform: "apple",
    status: "active",
    passObjectKey: objectKey,
    downloadUrl,
    message: "Apple Wallet pass generated.",
  };

  await certificateRepository.upsertWalletPass(tx, {
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    platform: "apple",
    passObjectKey: objectKey,
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
  if (!isCertificateFeatureEnabled("wallets")) {
    return {
      data: {
        platform: "google",
        status: "not_configured",
        message: "WALLET_FEATURE_DISABLED",
      },
    };
  }

  const certificate = await loadOwnedCertificate(tx, ctx, certificateId);

  if (!googleWalletConfigured()) {
    const result: WalletPassResult = {
      platform: "google",
      status: "not_configured",
      message:
        "Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_JSON.",
    };
    await certificateRepository.upsertWalletPass(tx, {
      tenantId: ctx.tenantId,
      certificateId: certificate.id,
      platform: "google",
      passObjectKey: null,
      externalId: null,
      status: result.status,
    });
    return { data: result };
  }

  const { saveUrl, objectId } = await buildGoogleSaveUrl(certificate);
  const result: WalletPassResult = {
    platform: "google",
    status: "active",
    saveUrl,
    message: "Google Wallet object created.",
  };

  await certificateRepository.upsertWalletPass(tx, {
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    platform: "google",
    passObjectKey: null,
    externalId: objectId,
    status: result.status,
  });

  return { data: result };
}

export type AppleWalletDownload = {
  body: Buffer;
  contentType: string;
  filename: string;
};

/** Database half of a pass download: ownership, and lazy issuance when no pass exists yet. */
export async function planAppleWalletPassDownload(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<{ passObjectKey: string; filename: string }> {
  if (!isCertificateFeatureEnabled("wallets")) {
    throw certificateNotFound();
  }

  const certificate = await loadOwnedCertificate(tx, ctx, certificateId);
  let pass = await certificateRepository.findWalletPass(tx, {
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    platform: "apple",
  });

  if (!pass?.pass_object_key || pass.status !== "active") {
    // Lazily issue so the download URL works after a fresh deploy. Issuance
    // still builds and stores the pass inside this transaction; only the
    // regular download path keeps storage I/O outside it.
    const issued = await issueAppleWalletPass(tx, ctx, certificateId);
    if (issued.data.status !== "active" || !issued.data.passObjectKey) {
      throw certificateNotFound();
    }
    pass = await certificateRepository.findWalletPass(tx, {
      tenantId: ctx.tenantId,
      certificateId: certificate.id,
      platform: "apple",
    });
  }

  if (!pass?.pass_object_key) {
    throw certificateNotFound();
  }
  return { passObjectKey: pass.pass_object_key, filename: `${certificate.credential_id}.pkpass` };
}

/** Storage half: run after the transaction, holding no pooled connection (audit H3). */
export async function materializeAppleWalletPassDownload(plan: {
  passObjectKey: string;
  filename: string;
}): Promise<AppleWalletDownload> {
  const { loadCertificateWalletPass } = await import("./certificate-wallet-store");
  const body = await loadCertificateWalletPass(plan.passObjectKey);
  if (!body) {
    throw certificateNotFound();
  }
  return { body, contentType: APPLE_PKPASS_CONTENT_TYPE, filename: plan.filename };
}

export async function getAppleWalletPassDownload(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<AppleWalletDownload> {
  return materializeAppleWalletPassDownload(
    await planAppleWalletPassDownload(tx, ctx, certificateId),
  );
}
