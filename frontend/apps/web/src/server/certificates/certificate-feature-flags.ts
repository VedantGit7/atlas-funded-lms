// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Certificate feature flags / extensibility toggles.
 *
 * Reads process.env at call time so a deploy can flip a capability without a
 * code change. Every flag is off-by-default except OpenBadge export, which is
 * on unless explicitly disabled. Keep the return shape stable — callers rely on
 * these keys to gate optional certificate surfaces (wallets, blockchain anchor,
 * PDF worker, learning-path certificates).
 */

export type CertificateFeatures = {
  openBadge: boolean;
  wallets: boolean;
  blockchainAnchor: boolean;
  pdfWorker: boolean;
  learningPathCerts: boolean;
};

export function certificateFeatures(): CertificateFeatures {
  return {
    openBadge: process.env["CERTIFICATE_OPEN_BADGE"] !== "false",
    wallets: process.env["CERTIFICATE_WALLETS"] === "true",
    blockchainAnchor: process.env["CERTIFICATE_BLOCKCHAIN_ANCHOR"] === "true",
    pdfWorker: process.env["CERTIFICATE_PDF_WORKER"] === "true",
    learningPathCerts: process.env["CERTIFICATE_LEARNING_PATH"] === "true",
  };
}

export function isCertificateFeatureEnabled(feature: keyof CertificateFeatures): boolean {
  return certificateFeatures()[feature];
}
