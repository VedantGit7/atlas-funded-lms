import Link from "next/link";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";

type SecuritySettingsPlaceholderPageProps = {
  title: string;
  description: string;
  relatedHref?: string;
  relatedLabel?: string;
};

export function SecuritySettingsPlaceholderPage({
  title,
  description,
  relatedHref,
  relatedLabel,
}: SecuritySettingsPlaceholderPageProps) {
  return (
    <>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>{description}</p>
      </header>

      <div className={generalSettingsFormCardClassName}>
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          This security setting is coming soon.{" "}
          {relatedHref && relatedLabel ? (
            <>
              In the meantime, manage related options from{" "}
              <Link
                href={relatedHref}
                prefetch={false}
                className="font-semibold text-[var(--admin-primary)] underline-offset-2 hover:underline"
              >
                {relatedLabel}
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}
