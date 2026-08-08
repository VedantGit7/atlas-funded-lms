"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import type { AboutSchoolView } from "@atlas/domain-branding/schemas/about-school";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { BrandingAnimatedCollapsible, inferBrandingContentType } from "./branding-admin-shared";

const NAME_LIMIT = 60;
const ABOUT_LIMIT = 300;

type SocialKey =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "telegram"
  | "discord"
  | "pinterest"
  | "reddit"
  | "snapchat"
  | "threads"
  | "twitch"
  | "spotify"
  | "medium"
  | "github"
  | "quora";

const SOCIALS: ReadonlyArray<{ key: SocialKey; label: string; icon: string }> = [
  { key: "facebook", label: "Facebook", icon: "/social-logos/facebook.svg" },
  { key: "instagram", label: "Instagram", icon: "/social-logos/instagram.svg" },
  { key: "twitter", label: "Twitter", icon: "/social-logos/x.svg" },
  { key: "linkedin", label: "LinkedIn", icon: "/social-logos/linkedin.svg" },
  { key: "youtube", label: "Youtube", icon: "/social-logos/youtube.svg" },
  { key: "tiktok", label: "TikTok", icon: "/social-logos/tiktok.svg" },
  { key: "whatsapp", label: "WhatsApp", icon: "/social-logos/whatsapp.svg" },
  { key: "telegram", label: "Telegram", icon: "/social-logos/telegram.svg" },
  { key: "discord", label: "Discord", icon: "/social-logos/discord.svg" },
  { key: "pinterest", label: "Pinterest", icon: "/social-logos/pinterest.svg" },
  { key: "reddit", label: "Reddit", icon: "/social-logos/reddit.svg" },
  { key: "snapchat", label: "Snapchat", icon: "/social-logos/snapchat.svg" },
  { key: "threads", label: "Threads", icon: "/social-logos/threads.svg" },
  { key: "twitch", label: "Twitch", icon: "/social-logos/twitch.svg" },
  { key: "spotify", label: "Spotify", icon: "/social-logos/spotify.svg" },
  { key: "medium", label: "Medium", icon: "/social-logos/medium.svg" },
  { key: "github", label: "GitHub", icon: "/social-logos/github.svg" },
  { key: "quora", label: "Quora", icon: "/social-logos/quora.svg" },
];

const fieldClass =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export function AboutSchoolWizard({ initial }: { initial: AboutSchoolView }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [basicSaved, setBasicSaved] = useState(false);

  const [schoolName, setSchoolName] = useState(initial.schoolName ?? "");
  const [browserTitle, setBrowserTitle] = useState(initial.browserTitle ?? "");
  const [about, setAbout] = useState(initial.about ?? "");
  const [imageRefId, setImageRefId] = useState(initial.imageRefId);
  const [imageUrl, setImageUrl] = useState(initial.schoolImageUrl);
  const [social, setSocial] = useState<Record<SocialKey, string>>(
    () =>
      Object.fromEntries(
        SOCIALS.map((item) => [item.key, initial.social[item.key] ?? ""]),
      ) as Record<SocialKey, string>,
  );

  const [busy, setBusy] = useState<null | "upload" | "save" | "publish">(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nameError = touched && schoolName.trim().length === 0 ? "School name is required." : null;
  const titleError = touched && browserTitle.trim().length === 0 ? "Browser title is required." : null;
  const basicValid = schoolName.trim().length > 0 && browserTitle.trim().length > 0;

  function buildPayload() {
    const normalise = (value: string) => (value.trim() ? value.trim() : null);
    return {
      schoolName: schoolName.trim(),
      browserTitle: browserTitle.trim(),
      about: normalise(about),
      imageRefId,
      social: Object.fromEntries(
        SOCIALS.map((item) => [item.key, normalise(social[item.key])]),
      ) as Record<SocialKey, string | null>,
    };
  }

  async function persist(): Promise<boolean> {
    setError(null);
    try {
      await clientApi.put<{ data: AboutSchoolView }>(
        "/api/v1/branding/about-school",
        buildPayload(),
        "about-school-update",
      );
      return true;
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not save your changes. Please try again.",
      );
      return false;
    }
  }

  async function onSaveAndNext() {
    setTouched(true);
    if (!basicValid) return;
    setBusy("save");
    setStatus(null);
    const ok = await persist();
    setBusy(null);
    if (ok) {
      setBasicSaved(true);
      setStep(2);
    }
  }

  async function onPublish() {
    setTouched(true);
    if (!basicValid) {
      setStep(1);
      return;
    }
    setBusy("publish");
    setStatus(null);
    setError(null);
    try {
      await clientApi.put("/api/v1/branding/about-school", buildPayload(), "about-school-update");
      await clientApi.post("/api/v1/branding/publish", null, "branding-publish");
      setStatus("About School details published.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not publish. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onImageSelected(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const contentType = inferBrandingContentType(file);
      if (!contentType) {
        setError("Unsupported file type. Upload a PNG, JPEG, or WebP image.");
        return;
      }
      const upload = await clientApi.post<{
        data: { asset: { id: string }; upload: { url: string; requiredHeaders: Record<string, string> } };
      }>(
        "/api/v1/branding/assets/upload",
        { purpose: "branding.og-image", fileName: file.name, contentType, sizeBytes: file.size },
        "about-school-image-upload",
      );
      await fetch(upload.data.upload.url, {
        method: "PUT",
        headers: upload.data.upload.requiredHeaders,
        body: file,
      });
      setImageRefId(upload.data.asset.id);
      setImageUrl(URL.createObjectURL(file));
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not upload the image.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Link
          href="/admin/branding"
          prefetch={false}
          className="text-[var(--admin-primary)] transition-colors hover:opacity-80"
        >
          Branding
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">/</span>
        <span className="text-[var(--admin-on-surface-variant)]">About School</span>
      </nav>

      <header className="mt-4 border-b border-[var(--admin-border)] pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
          About School
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          Add details about your school
        </p>
      </header>

      <Stepper step={step} basicSaved={basicSaved} onSelect={(next) => {
        if (next === 1) setStep(1);
      }} />

      <BrandingAnimatedCollapsible open={Boolean(status)} id="about-school-status">
        {status ? (
          <p
            role="status"
            className="rounded-lg border border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 px-4 py-3 text-sm text-[var(--admin-success)]"
          >
            {status}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <BrandingAnimatedCollapsible open={Boolean(error)} id="about-school-error" noTopMargin={!status}>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
          >
            {error}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <div className="mt-8">
        {step === 1 ? (
          <div className="space-y-6 motion-safe:animate-[admin-slide-up_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <CounterField
              id="school-name"
              label="School Name"
              required
              value={schoolName}
              max={NAME_LIMIT}
              error={nameError}
              hint="This name will be used for your institute and all learner communications"
              onChange={setSchoolName}
              placeholder="Your school name"
            />
            <CounterField
              id="browser-title"
              label="Browser Title"
              required
              value={browserTitle}
              max={NAME_LIMIT}
              error={titleError}
              hint="This will be displayed in search results and in your browser's title bar"
              onChange={setBrowserTitle}
              placeholder="Your browser tab title"
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="about-text" className="text-sm font-bold text-[var(--admin-on-surface)]">
                  About School
                </label>
                <span className="text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
                  {about.length}/{ABOUT_LIMIT}
                </span>
              </div>
              <textarea
                id="about-text"
                rows={3}
                value={about}
                maxLength={ABOUT_LIMIT}
                onChange={(event) => {
                  setAbout(event.target.value);
                }}
                placeholder="A short description of your school"
                className={`${fieldClass} resize-y`}
              />
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-bold text-[var(--admin-on-surface)]">School Image</p>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">Add image for your school page</p>
              </div>
              <ImageUploader
                imageUrl={imageUrl}
                busy={busy === "upload"}
                onPick={() => fileInputRef.current?.click()}
                onRemove={() => {
                  setImageRefId(null);
                  setImageUrl(null);
                }}
              />
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Upload .png format in minimum resolution of 500 x 280 pixels.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void onImageSelected(file);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 motion-safe:animate-[admin-slide-up_0.3s_cubic-bezier(0.16,1,0.3,1)] sm:grid-cols-2">
            {SOCIALS.map((item) => (
              <div key={item.key} className="space-y-2">
                <label htmlFor={`social-${item.key}`} className="text-sm font-bold text-[var(--admin-on-surface)]">
                  {item.label}
                </label>
                <div className="flex items-stretch gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-certificate-paper)]">
                    <img src={item.icon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
                  </span>
                  <input
                    id={`social-${item.key}`}
                    type="url"
                    inputMode="url"
                    value={social[item.key]}
                    onChange={(event) => {
                      setSocial((current) => ({ ...current, [item.key]: event.target.value }));
                    }}
                    placeholder={`Enter your ${item.label.toLowerCase()} link`}
                    className={fieldClass}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="admin-glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-border)] px-4 py-4 motion-safe:animate-[admin-slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)] md:px-8 lg:left-[280px]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (step === 2) setStep(1);
              else router.push("/admin/branding");
            }}
            className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy !== null || step === 2}
              onClick={() => void onSaveAndNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-100 disabled:shadow-none"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Save &amp; next
            </button>
            <button
              type="button"
              disabled={busy !== null || step === 1}
              onClick={() => void onPublish()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-surface)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-100 disabled:shadow-none"
            >
              {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Publish
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stepper({
  step,
  basicSaved,
  onSelect,
}: {
  step: 1 | 2;
  basicSaved: boolean;
  onSelect: (step: 1 | 2) => void;
}) {
  const items: Array<{ n: 1 | 2; label: string }> = [
    { n: 1, label: "Basic Details" },
    { n: 2, label: "Social Links" },
  ];
  return (
    <div className="mt-8 flex items-center gap-6">
      {items.map((item) => {
        const active = step === item.n;
        const complete = item.n === 1 && basicSaved && step === 2;
        return (
          <button
            key={item.n}
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={() => {
              onSelect(item.n);
            }}
            className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] rounded-md"
          >
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold motion-safe:transition-colors motion-safe:duration-200",
                complete
                  ? "bg-[var(--admin-success)] text-[var(--admin-on-primary)]"
                  : active
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : item.n}
            </span>
            <span
              className={[
                "text-lg font-bold",
                active || complete ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CounterField({
  id,
  label,
  value,
  max,
  required,
  error,
  hint,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  required?: boolean;
  error?: string | null;
  hint: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-bold text-[var(--admin-on-surface)]">
          {label}
          {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
        </label>
        <span className="text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
          {value.length}/{max}
        </span>
      </div>
      <input
        id={id}
        value={value}
        maxLength={max}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={`${fieldClass} ${error ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/30" : ""}`}
      />
      {error ? (
        <p className="text-xs font-medium text-[var(--admin-danger)]">{error}</p>
      ) : (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{hint}</p>
      )}
    </div>
  );
}

function ImageUploader({
  imageUrl,
  busy,
  onPick,
  onRemove,
}: {
  imageUrl: string | null;
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <div className="flex aspect-[500/280] items-center justify-center overflow-hidden bg-[var(--admin-surface-high)]">
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--admin-primary)]" aria-hidden="true" />
        ) : imageUrl ? (
          <img src={imageUrl} alt="School image preview" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-[var(--admin-on-surface-variant)] opacity-40" aria-hidden="true" />
        )}
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-[var(--admin-border)] p-3">
        <button
          type="button"
          disabled={busy || !imageUrl}
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2 text-sm font-semibold text-[var(--admin-surface)] transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload
        </button>
      </div>
    </div>
  );
}
