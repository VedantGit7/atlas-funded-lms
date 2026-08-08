"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Camera, Info, Pencil } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { SettingsSelectField, type SettingsSelectOption } from "../../account-settings/account-settings-fields";
import { AccountSettingsToast } from "../../account-settings/account-settings-toast";
import { useAccountTheme } from "../../account-settings/account-theme-context";
import { COMMON_BCP47_LOCALES } from "../../locales/locales-common-locales";

type ProfileFormProps = {
  membershipId: string;
  initialDisplayName: string | null;
  initialBio: string | null;
  initialAvatarUrl?: string | null;
  initialTimezone: string | null;
  initialLocale: string | null;
  email: string | null;
};

type SignedUploadResponse = {
  data: {
    asset: { id: string; bucket: string; key: string };
    upload: { method: "PUT"; url: string; expiresAt: string; requiredHeaders: Record<string, string> };
  };
};

type ConfirmAvatarResponse = {
  data: { avatarUrl: string | null };
};

const TIMEZONE_OPTIONS: string[] = Intl.supportedValuesOf("timeZone");

const LOCALE_OPTIONS: SettingsSelectOption[] = [
  { value: "", label: "System default" },
  ...COMMON_BCP47_LOCALES.map((locale) => ({ value: locale.value, label: locale.label })),
];

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update profile.", requestId: null };
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatTimezoneLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return `${offset} ${tz.replace(/_/g, " ")}`.trim();
  } catch {
    return tz.replace(/_/g, " ");
  }
}

const TIMEZONE_SELECT_OPTIONS: SettingsSelectOption[] = [
  { value: "", label: "Not set" },
  ...TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: formatTimezoneLabel(tz) })),
];

export function ProfileForm({
  membershipId,
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
  initialTimezone,
  initialLocale,
  email,
}: ProfileFormProps) {
  const router = useRouter();
  const { classes } = useAccountTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [timezone, setTimezone] = useState(initialTimezone ?? "");
  const [locale, setLocale] = useState(initialLocale ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const isDirty = useMemo(
    () =>
      displayName !== (initialDisplayName ?? "") ||
      bio !== (initialBio ?? "") ||
      timezone !== (initialTimezone ?? "") ||
      locale !== (initialLocale ?? ""),
    [bio, displayName, initialBio, initialDisplayName, initialLocale, initialTimezone, locale, timezone],
  );

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      const requests: Promise<unknown>[] = [
        clientApi.put(
          `/api/v1/members/${membershipId}/profile`,
          {
            displayName: displayName.trim() || null,
            bio: bio.trim() || null,
            timezone: timezone.trim() || null,
          },
          "profile-update",
        ),
      ];

      if (locale !== (initialLocale ?? "")) {
        requests.push(
          clientApi.put("/api/v1/me/preferences", { locale: locale || null }, "profile-locale-update", {
            silent: true,
          }),
        );
      }

      await Promise.all(requests);
      setToastOpen(true);
      router.refresh();
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  function discardChanges() {
    setDisplayName(initialDisplayName ?? "");
    setBio(initialBio ?? "");
    setTimezone(initialTimezone ?? "");
    setLocale(initialLocale ?? "");
    setMessage(null);
    setRequestId(null);
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      const signed = await clientApi.post<SignedUploadResponse>(
        "/api/v1/me/avatar/upload",
        { fileName: file.name, contentType: file.type, sizeBytes: file.size },
        "avatar-upload",
        { silent: true },
      );

      const putResponse = await fetch(signed.data.upload.url, {
        method: signed.data.upload.method,
        headers: signed.data.upload.requiredHeaders,
        body: file,
      });

      if (!putResponse.ok) {
        throw new Error("AVATAR_BLOB_UPLOAD_FAILED");
      }

      const confirmed = await clientApi.post<ConfirmAvatarResponse>(
        "/api/v1/me/avatar/confirm",
        { assetReferenceId: signed.data.asset.id },
        "avatar-confirm",
      );

      setAvatarUrl(confirmed.data.avatarUrl);
      setToastOpen(true);
      router.refresh();
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/me/avatar", "avatar-remove");
      setAvatarUrl(null);
      setToastOpen(true);
      router.refresh();
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile();
        }}
      >
        <section className={classes.card}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Avatar upload */}
            <div className="flex flex-col items-center md:col-span-4">
              <div className="group relative">
                <button
                  type="button"
                  aria-label="Change avatar"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[var(--acct-surface-high)] shadow-sm transition-opacity disabled:cursor-not-allowed"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--acct-surface-low)] text-2xl font-semibold text-[var(--acct-on-surface)]">
                      {initialsOf(displayName || "?")}
                    </div>
                  )}
                  <span className={classes.avatarOverlay}>
                    <Camera className="h-6 w-6" aria-hidden="true" />
                    <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest">
                      Change
                    </span>
                  </span>
                </button>
                <span className="pointer-events-none absolute bottom-1 right-1 rounded-full border-2 border-[var(--acct-surface-lowest)] bg-[var(--acct-primary)] p-1.5 text-[var(--acct-on-primary)] shadow">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadAvatar(file);
                }}
              />
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-[var(--acct-on-surface)]">Profile photo</p>
                <p className={`${classes.helper} mt-1`}>JPG, PNG, or WebP. Max 800 KB.</p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className={classes.ghostButton}
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? "Working…" : "Upload"}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--acct-danger)] underline-offset-2 hover:underline disabled:opacity-50"
                    disabled={avatarBusy}
                    onClick={() => void removeAvatar()}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-6 md:col-span-8">
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-display-name" className={classes.label}>
                  Display name
                </label>
                <input
                  id="profile-display-name"
                  className={classes.field}
                  placeholder="Enter your full name"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                  }}
                />
                <p className={classes.helper}>
                  This name is shown on your certificates and public profile.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className={classes.label}>Email address</span>
                <div className={classes.readOnlyField}>
                  <span className="truncate text-sm text-[var(--acct-on-surface-variant)]">
                    {email ?? "No email on file"}
                  </span>
                  <Link href="/profile/security" className={classes.ghostButton}>
                    Change email
                  </Link>
                </div>
                <p className={classes.helper}>Your primary login email.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="profile-bio" className={classes.label}>
                  Bio
                </label>
                <textarea
                  id="profile-bio"
                  className={`${classes.field} resize-none`}
                  placeholder="Tell us about your learning journey…"
                  rows={3}
                  value={bio}
                  onChange={(event) => {
                    setBio(event.target.value);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className={classes.label}>Timezone</span>
                  <SettingsSelectField
                    ariaLabel="Timezone"
                    value={timezone}
                    onChange={setTimezone}
                    options={TIMEZONE_SELECT_OPTIONS}
                    placeholder="Not set"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className={classes.label}>Language</span>
                  <SettingsSelectField
                    ariaLabel="Preferred language"
                    value={locale}
                    onChange={setLocale}
                    options={LOCALE_OPTIONS}
                    placeholder="System default"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-8 flex items-center justify-end gap-4 border-t pt-6 ${classes.divider}`}>
            <button
              type="button"
              className="text-xs font-medium text-[var(--acct-on-surface-variant)] transition-colors hover:text-[var(--acct-on-surface)] disabled:opacity-40"
              disabled={!isDirty || busy}
              onClick={discardChanges}
            >
              Cancel
            </button>
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

        <div className="flex items-start gap-4 rounded-xl border border-[color-mix(in_srgb,var(--acct-primary-container)_25%,transparent)] bg-[color-mix(in_srgb,var(--acct-primary-container)_8%,transparent)] p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acct-primary)]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[var(--acct-primary)]">Did you know?</p>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--acct-on-surface-variant)]">
              Keeping your profile current helps us tailor course recommendations to your region and
              goals.
            </p>
          </div>
        </div>
      </form>

      <AccountSettingsToast
        message="Profile updated successfully"
        open={toastOpen}
        onClose={() => {
          setToastOpen(false);
        }}
      />
    </>
  );
}
