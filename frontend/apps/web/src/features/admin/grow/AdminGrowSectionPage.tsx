"use client";

import {
  managePageDescClassName,
  managePageTitleClassName,
  manageTableCardClassName,
} from "../manage/manage-ui-shared";
import { getAdminMarketingSection, type AdminMarketingSlug } from "./admin-marketing-catalog";
import { getAdminSalesSection, type AdminSalesSlug } from "./admin-sales-catalog";
import { MarketingMessengerHub } from "./MarketingMessengerHub";
import { CtaListPanel } from "./CtaListPanel";
import { CampaignsListPanel } from "./CampaignsListPanel";
import { FormsListPanel } from "./FormsListPanel";
import { PromoSliderListPanel } from "./PromoSliderListPanel";
import { EventsListPanel } from "./EventsListPanel";
import { IntegrationsHubPanel } from "./IntegrationsHubPanel";
import { NewsfeedListPanel } from "./NewsfeedListPanel";
import { WorkflowsListPanel } from "./WorkflowsListPanel";
import { CouponsListPanel } from "./CouponsListPanel";
import { WalletAdminPanel } from "./WalletAdminPanel";
import { ReferralAdminPanel } from "./ReferralAdminPanel";
import { AffiliatesAdminPanel } from "./AffiliatesAdminPanel";

type GrowSectionPageProps =
  | { kind: "marketing"; slug: AdminMarketingSlug }
  | { kind: "sales"; slug: AdminSalesSlug };

export function AdminGrowSectionPage(props: GrowSectionPageProps) {
  if (props.kind === "sales" && props.slug === "coupons") {
    return <CouponsListPanel />;
  }

  if (props.kind === "sales" && props.slug === "wallet") {
    return <WalletAdminPanel />;
  }

  if (props.kind === "sales" && props.slug === "referral-code") {
    return <ReferralAdminPanel />;
  }

  if (props.kind === "sales" && props.slug === "affiliates") {
    return <AffiliatesAdminPanel />;
  }

  if (props.kind === "marketing" && props.slug === "messenger") {
    return <MarketingMessengerHub />;
  }

  if (props.kind === "marketing" && props.slug === "workflows") {
    return <WorkflowsListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "campaign") {
    return <CampaignsListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "forms") {
    return <FormsListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "cta") {
    return <CtaListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "promo-slider") {
    return <PromoSliderListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "events") {
    return <EventsListPanel />;
  }

  if (props.kind === "marketing" && props.slug === "integrations") {
    return <IntegrationsHubPanel />;
  }

  if (props.kind === "marketing" && props.slug === "newsfeed") {
    return <NewsfeedListPanel />;
  }

  const section =
    props.kind === "marketing"
      ? getAdminMarketingSection(props.slug)
      : getAdminSalesSection(props.slug);

  if (!section) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className={managePageTitleClassName}>{section.title}</h1>
        <p className={managePageDescClassName}>{section.description}</p>
      </header>

      <div
        className={`${manageTableCardClassName} flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center`}
      >
        <p className="text-lg font-semibold text-[var(--admin-on-surface)]">{section.title}</p>
        <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
          {section.description}
        </p>
      </div>
    </div>
  );
}
