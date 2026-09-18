import { loadPublicBootstrap } from "../../../lib/server/bootstrap";

/**
 * The academy name shown in the certificate studio.
 *
 * The fallback used to be the literal "FundedBeyond", so any tenant whose
 * bootstrap call failed saw tenant #1's brand on their own certificate studio.
 * A neutral placeholder is the only safe default on a white-label platform.
 */
const FALLBACK_PUBLIC_NAME = "Your academy";

export async function loadCertificateStudioPublicName(): Promise<string> {
  try {
    const bootstrap = await loadPublicBootstrap();
    return bootstrap.publicName?.trim() || bootstrap.issuerName?.trim() || FALLBACK_PUBLIC_NAME;
  } catch {
    return FALLBACK_PUBLIC_NAME;
  }
}
