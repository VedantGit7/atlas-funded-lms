// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export const READINESS_POLICY_KEY = "default" as const;
export const DEFAULT_COMPOSITE_KEY = "default" as const;

export const CTA_PROMINENCE_VALUES = ["hidden", "subtle", "standard", "prominent"] as const;
export type CtaProminence = (typeof CTA_PROMINENCE_VALUES)[number];

export type BandProminenceRule = {
  bandKey: string;
  prominence: CtaProminence;
};

export type CtaPolicyConfig = {
  outboundTargetUrl: string;
  tokenTtlSeconds: number;
  bandProminenceRules: BandProminenceRule[];
  ctaCopy: {
    headline: string;
    body: string;
    buttonLabel: string;
  };
};

export type LegalCopyConfig = {
  disclaimer: string;
  bandNotes: Record<string, string>;
  legalReviewChecklist: string[];
};

export type ReadinessPolicyDto = {
  id: string;
  key: string;
  scoringProfileId: string;
  ctaPolicy: CtaPolicyConfig;
  legalCopy: LegalCopyConfig | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export type CompositeReadinessProjection = {
  compositeKey: string;
  scoringProfileId: string;
  score: number;
  bandKey: string;
  prominence: CtaProminence;
  calculatedAt: string;
};

export type ReadinessEvaluationDto = {
  composites: CompositeReadinessProjection[];
};

export type AttributionTokenResponse = {
  outboundUrl: string;
  expiresAt: string;
  tokenId: string;
};
