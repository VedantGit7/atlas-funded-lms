import type { Metadata } from "next";
import { PageGate } from "../../../components/patterns/PageGate";
import { HelpCenterHome } from "../../../features/help-center/components/HelpCenterHome";
import { loadPublicBootstrap } from "../../../lib/server/bootstrap";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Search guides for courses, diagnostics, certificates, billing, account settings, and troubleshooting.",
};

export default async function HelpCenterPage() {
  let academyName = "your academy";

  try {
    const bootstrap = await loadPublicBootstrap();
    academyName = bootstrap.publicName?.trim() || bootstrap.issuerName?.trim() || academyName;
  } catch {
    // Decorative label only; page works without bootstrap.
  }

  return (
    <PageGate state="ready" title="Help Center">
      <HelpCenterHome academyName={academyName} />
    </PageGate>
  );
}
