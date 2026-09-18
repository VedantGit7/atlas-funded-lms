import type { z } from "zod";
import type { PublicLandingPageSchema } from "@atlas/contracts/domain-branding/schemas/public-landing";
import { TenantPublicLanding } from "./landing/TenantPublicLanding";
import { LandingVisitAttribution } from "../../../components/attribution/LandingVisitAttribution";

type PublicLandingPage = z.infer<typeof PublicLandingPageSchema>;

export type LandingAuthCta = {
  label: string;
  href: string;
};

type PublicLandingViewProps = {
  landing: PublicLandingPage;
  requestId: string;
  /** When set, nav shows this instead of Sign In (server-resolved session). */
  authCta?: LandingAuthCta | null;
  /** The tenant's own logo; without one the nav shows their initials mark. */
  logoUrl?: string | null;
};

export function PublicLandingView({
  landing,
  authCta = null,
  logoUrl = null,
}: PublicLandingViewProps) {
  return (
    <>
      <LandingVisitAttribution />
      <TenantPublicLanding landing={landing} authCta={authCta} logoUrl={logoUrl} />
    </>
  );
}
