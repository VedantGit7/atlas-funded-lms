import { loadPublicBootstrap } from "../../../lib/server/bootstrap";

export async function loadCertificateStudioPublicName(): Promise<string> {
  let publicName = "FundedBeyond";
  try {
    const bootstrap = await loadPublicBootstrap();
    publicName =
      bootstrap.publicName?.trim() || bootstrap.issuerName?.trim() || publicName;
  } catch {
    // Keep FundedBeyond fallback.
  }
  return publicName;
}
