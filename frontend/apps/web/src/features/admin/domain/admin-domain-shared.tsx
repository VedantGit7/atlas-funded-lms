"use client";

import type { ReactNode } from "react";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { analyticsAlertErrorClassName } from "../../analytics/analytics-admin-shared";

type AdminDomainPageShellProps = {
  title: string;
  description: string;
  error?: string | null;
  children: ReactNode;
};

export function AdminDomainPageShell({ title, description, error, children }: AdminDomainPageShellProps) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>{description}</p>
      </header>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      {children}
    </div>
  );
}

export { generalSettingsFormCardClassName as adminDomainCardClassName };
