"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, BarChart3, Download, Globe, Lock, Mail, Trash2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { SettingsToggleRow } from "../../account-settings/account-settings-fields";
import { AccountSettingsToast } from "../../account-settings/account-settings-toast";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type ProfileVisibility = "PUBLIC" | "PRIVATE";

type PrivacyState = {
  analyticsConsent: boolean;
  marketingConsent: boolean;
  showLearningActivity: boolean;
};

type PrivacyDataFormProps = {
  membershipId: string;
  initialVisibility: ProfileVisibility;
  initialPrivacy: PrivacyState;
};

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update privacy settings.", requestId: null };
}

export function PrivacyDataForm({
  membershipId,
  initialVisibility,
  initialPrivacy,
}: PrivacyDataFormProps) {
  const { classes } = useAccountTheme();
  const [visibility, setVisibility] = useState<ProfileVisibility>(initialVisibility);
  const [privacy, setPrivacy] = useState<PrivacyState>(initialPrivacy);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isDirty = useMemo(
    () =>
      visibility !== initialVisibility ||
      JSON.stringify(privacy) !== JSON.stringify(initialPrivacy),
    [initialPrivacy, initialVisibility, privacy, visibility],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      const requests: Promise<unknown>[] = [];
      if (visibility !== initialVisibility) {
        requests.push(
          clientApi.put(
            `/api/v1/members/${membershipId}/profile`,
            { profileVisibility: visibility },
            "privacy-visibility-update",
            { silent: true },
          ),
        );
      }
      if (JSON.stringify(privacy) !== JSON.stringify(initialPrivacy)) {
        requests.push(
          clientApi.put("/api/v1/me/preferences", { privacy }, "privacy-consent-update", {
            silent: true,
          }),
        );
      }
      await Promise.all(requests);
      setToast("Privacy settings saved");
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function downloadData() {
    setExporting(true);
    setMessage(null);
    setRequestId(null);
    try {
      const [account, profile, preferences, entitlements] = await Promise.all([
        clientApi.get<{ data: unknown }>("/api/v1/me"),
        clientApi.get<{ data: unknown }>(`/api/v1/members/${membershipId}/profile`),
        clientApi.get<{ data: unknown }>("/api/v1/me/preferences"),
        clientApi
          .get<{ data: unknown }>("/api/v1/entitlements")
          .catch(() => ({ data: [] as unknown })),
      ]);

      const bundle = {
        exportedAt: new Date().toISOString(),
        account: account.data,
        profile: profile.data,
        preferences: preferences.data,
        entitlements: entitlements.data,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast("Your data export has been downloaded");
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className={`${classes.card} space-y-5`}>
          <div>
            <h2 className={classes.sectionTitle}>Profile visibility</h2>
            <p className={classes.sectionDesc}>
              Control how you appear in community, hall of fame, and leaderboards.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={visibility === "PUBLIC"}
              onClick={() => {
                setVisibility("PUBLIC");
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all motion-safe:active:scale-[0.99] ${
                visibility === "PUBLIC"
                  ? "border-[var(--acct-primary)] bg-[color-mix(in_srgb,var(--acct-primary-container)_10%,transparent)]"
                  : "border-[var(--acct-border)] hover:border-[var(--acct-outline)]"
              }`}
            >
              <Globe
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  visibility === "PUBLIC" ? "text-[var(--acct-primary)]" : "text-[var(--acct-on-surface-variant)]"
                }`}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--acct-on-surface)]">Public</span>
                <span className="mt-0.5 block text-xs text-[var(--acct-on-surface-variant)]">
                  Your name, avatar, and bio are shown to other members.
                </span>
              </span>
            </button>

            <button
              type="button"
              aria-pressed={visibility === "PRIVATE"}
              onClick={() => {
                setVisibility("PRIVATE");
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all motion-safe:active:scale-[0.99] ${
                visibility === "PRIVATE"
                  ? "border-[var(--acct-primary)] bg-[color-mix(in_srgb,var(--acct-primary-container)_10%,transparent)]"
                  : "border-[var(--acct-border)] hover:border-[var(--acct-outline)]"
              }`}
            >
              <Lock
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  visibility === "PRIVATE" ? "text-[var(--acct-primary)]" : "text-[var(--acct-on-surface-variant)]"
                }`}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--acct-on-surface)]">Private</span>
                <span className="mt-0.5 block text-xs text-[var(--acct-on-surface-variant)]">
                  You appear as an anonymous member across community surfaces.
                </span>
              </span>
            </button>
          </div>
        </section>

        <section className={classes.card}>
          <div className="mb-4">
            <h2 className={classes.sectionTitle}>Data & consent</h2>
            <p className={classes.sectionDesc}>Choose how your data is used across the academy.</p>
          </div>
          <div className={classes.panel}>
            <SettingsToggleRow
              icon={Activity}
              title="Show my learning activity"
              description="Display recent progress and achievements on your public profile."
              checked={privacy.showLearningActivity}
              onChange={(checked) => {
                setPrivacy((current) => ({ ...current, showLearningActivity: checked }));
              }}
            />
            <SettingsToggleRow
              icon={BarChart3}
              title="Product analytics"
              description="Allow anonymized usage analytics that help improve the platform."
              checked={privacy.analyticsConsent}
              onChange={(checked) => {
                setPrivacy((current) => ({ ...current, analyticsConsent: checked }));
              }}
            />
            <SettingsToggleRow
              icon={Mail}
              title="Product news and tips"
              description="Receive occasional emails about new features and learning tips."
              checked={privacy.marketingConsent}
              onChange={(checked) => {
                setPrivacy((current) => ({ ...current, marketingConsent: checked }));
              }}
            />
          </div>

          <div className={`mt-6 flex items-center justify-end gap-4 border-t pt-6 ${classes.divider}`}>
            <button
              type="submit"
              className={isDirty && !busy ? classes.primaryButton : classes.primaryButtonMuted}
              disabled={!isDirty || busy}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>

          {message ? (
            <p role="alert" className={`${classes.errorBanner} mt-6`}>
              {message}
              {requestId ? ` Request ID: ${requestId}` : ""}
            </p>
          ) : null}
        </section>
      </form>

      <section className={classes.card}>
        <h2 className={classes.sectionTitle}>Your data</h2>
        <p className={`${classes.sectionDesc} mt-1`}>
          Download a copy of your account data, or request permanent erasure.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={classes.outlineButton}
            disabled={exporting}
            onClick={() => {
              void downloadData();
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? "Preparing…" : "Download my data"}
          </button>
          <Link href="/profile/danger-zone" className={classes.dangerOutlineButton}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Request account deletion
          </Link>
        </div>
      </section>

      <AccountSettingsToast
        message={toast ?? ""}
        open={toast !== null}
        onClose={() => {
          setToast(null);
        }}
      />
    </>
  );
}
