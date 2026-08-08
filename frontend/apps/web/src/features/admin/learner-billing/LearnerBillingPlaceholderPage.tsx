import Link from "next/link";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";

type LearnerBillingPlaceholderPageProps = {
  title: string;
  description: string;
};

export function LearnerBillingPlaceholderPage({
  title,
  description,
}: LearnerBillingPlaceholderPageProps) {
  return (
    <>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>{description}</p>
      </header>

      <div className={generalSettingsFormCardClassName}>
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          Learner billing configuration for this setting is coming soon. You can manage academy
          subscription billing from{" "}
          <Link
            href="/admin/billing"
            prefetch={false}
            className="font-semibold text-[var(--admin-primary)] underline-offset-2 hover:underline"
          >
            Billing/Pricing Plan
          </Link>
          .
        </p>
      </div>
    </>
  );
}
