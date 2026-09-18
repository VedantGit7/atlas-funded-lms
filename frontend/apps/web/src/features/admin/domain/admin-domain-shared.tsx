"use client";

import type { ReactNode } from "react";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { analyticsAlertErrorClassName } from "../../analytics/analytics-admin-shared";
import { PageGate } from "../../../components/patterns/PageGate";
import { ClientApiError } from "../../../lib/client-api";

/**
 * True when the API refused the request for authorization reasons.
 *
 * Server-rendered admin pages catch `ServerApiError` 401/403 and render
 * `AdminPageGate state="denied"`. The client-side domain panels did not: every
 * failure — including a 403 — was flattened into `error.message` and shown as a
 * generic inline banner beneath a page that still claimed to be `ready`. Six
 * screens (batches, polls, live sessions, custom fields, messenger, devices)
 * behaved differently from the other 219 for the same underlying condition.
 */
export function isAuthorizationDenied(error: unknown): boolean {
  return error instanceof ClientApiError && (error.status === 401 || error.status === 403);
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : fallback;
}

type AdminDomainPageShellProps = {
  title: string;
  description: string;
  /** The caught error itself, not a pre-flattened message — see isAuthorizationDenied. */
  error?: unknown;
  errorFallback?: string;
  children: ReactNode;
};

export function AdminDomainPageShell({
  title,
  description,
  error,
  errorFallback = "Something went wrong while loading this page.",
  children,
}: AdminDomainPageShellProps) {
  // A denial replaces the page rather than annotating it: rendering the normal
  // controls under a banner invites the user to retry actions they cannot perform.
  if (isAuthorizationDenied(error)) {
    return <PageGate state="denied" title={title} />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>{description}</p>
      </header>

      {error ? (
        <div className={analyticsAlertErrorClassName}>{toErrorMessage(error, errorFallback)}</div>
      ) : null}

      {children}
    </div>
  );
}

export { generalSettingsFormCardClassName as adminDomainCardClassName };
