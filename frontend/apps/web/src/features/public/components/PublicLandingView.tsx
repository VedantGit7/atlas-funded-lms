import type { z } from "zod";
import type { PublicLandingPageSchema } from "@atlas/contracts/domain-branding/schemas/public-landing";
import { FundedBeyondLanding } from "./landing/FundedBeyondLanding";
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
};

export function PublicLandingView({ landing, authCta = null }: PublicLandingViewProps) {
  return (
    <>
      <LandingVisitAttribution />
      <FundedBeyondLanding landing={landing} authCta={authCta} />
    </>
  );
}
