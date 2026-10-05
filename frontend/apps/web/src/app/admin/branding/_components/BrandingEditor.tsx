"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Clock,
  Edit3,
  ImageIcon,
  Loader2,
  Rocket,
  School,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import type { z } from "zod";
import type { TenantBrandingViewSchema } from "@atlas/domain-branding/schemas/branding";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";
import type { UpdateTenantThemeRequest } from "@atlas/domain-branding/schemas/theme";
import { diffThemeTokens, formatThemeTokenLabel } from "@atlas/domain-branding/utils/theme-diff";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { ConfirmDialog } from "../../../../components/patterns/ConfirmDialog";
import { BrandPreview } from "./BrandPreview";
import { ThemeTokenEditor } from "./ThemeTokenEditor";
import {
  BrandingAnimatedCollapsible,
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  formatRelativeUpdatedAt,
  ghostButtonClassName,
  inferBrandingContentType,
  labelClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  previewStickyClassName,
  primaryButtonClassName,
  sectionDescClassName,
  sectionTitleClassName,
  statusBannerClassName,
  uploadBrandingAsset,
} from "./branding-admin-shared";

type BrandingView = z.infer<typeof TenantBrandingViewSchema>;
type ThemeView = z.infer<typeof TenantThemeViewSchema>;
type ThemeTokens = UpdateTenantThemeRequest["tokens"];

type BrandingEditorProps = {
  branding: BrandingView;
  theme: ThemeView;
  publishedBaselineTokens: ThemeTokens | null;
  children?: ReactNode;
};

type LogoVariant = "light" | "dark" | "favicon";

const EMPTY_TOKEN_VALUE = "none";

export function BrandingEditor({
  branding,
  theme,
  publishedBaselineTokens,
  children,
}: BrandingEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialPublicName = branding.publicName ?? "";
  const initialIssuerName = branding.issuerName ?? "";
  const initialHeadline =
    typeof branding.publicLandingCopy?.["headline"] === "string"
      ? branding.publicLandingCopy["headline"]
      : "";

  const [publicName, setPublicName] = useState(initialPublicName);
  const [issuerName, setIssuerName] = useState(initialIssuerName);
  const [headline, setHeadline] = useState(initialHeadline);
  const [tokens, setTokens] = useState<ThemeTokens>(theme.tokens);
  const [logoLightRef, setLogoLightRef] = useState(branding.logoLight?.storageRefId ?? null);
  const [logoDarkRef, setLogoDarkRef] = useState(branding.logoDark?.storageRefId ?? null);
  const [faviconRef, setFaviconRef] = useState(branding.favicon?.storageRefId ?? null);
  const [pendingUploadVariant, setPendingUploadVariant] = useState<LogoVariant | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const themeDiff = useMemo(
    () => diffThemeTokens(publishedBaselineTokens, tokens),
    [publishedBaselineTokens, tokens],
  );

  const brandingDirtyItems = useMemo(() => {
    const items: string[] = [];
    if (publicName.trim() !== initialPublicName.trim()) {
      items.push("Academy name updated");
    }
    if (issuerName.trim() !== initialIssuerName.trim()) {
      items.push("Issuer name updated");
    }
    if (headline.trim() !== initialHeadline.trim()) {
      items.push("Landing headline updated");
    }
    if (logoLightRef !== (branding.logoLight?.storageRefId ?? null)) {
      items.push("Light mode logo asset changed");
    }
    if (logoDarkRef !== (branding.logoDark?.storageRefId ?? null)) {
      items.push("Dark mode logo asset changed");
    }
    if (faviconRef !== (branding.favicon?.storageRefId ?? null)) {
      items.push("Favicon asset changed");
    }
    return items;
  }, [
    branding.favicon?.storageRefId,
    branding.logoDark?.storageRefId,
    branding.logoLight?.storageRefId,
    faviconRef,
    headline,
    initialHeadline,
    initialIssuerName,
    initialPublicName,
    issuerName,
    logoDarkRef,
    logoLightRef,
    publicName,
  ]);

  const pendingCount = brandingDirtyItems.length + themeDiff.length;
  const lastSavedAt =
    new Date(branding.updatedAt) > new Date(theme.updatedAt) ? branding.updatedAt : theme.updatedAt;

  const previewBranding: BrandingView = {
    ...branding,
    publicName: publicName.trim() || branding.publicName,
    issuerName: issuerName.trim() || branding.issuerName,
    publicLandingCopy: headline.trim() ? { headline: headline.trim() } : branding.publicLandingCopy,
    logoLight: logoLightRef
      ? { storageRefId: logoLightRef, altText: publicName.trim() || null }
      : null,
    logoDark: logoDarkRef
      ? { storageRefId: logoDarkRef, altText: publicName.trim() || null }
      : null,
    favicon: faviconRef ? { storageRefId: faviconRef, altText: publicName.trim() || null } : null,
  };

  const previewTheme: ThemeView = { ...theme, tokens };

  function discardChanges() {
    setPublicName(initialPublicName);
    setIssuerName(initialIssuerName);
    setHeadline(initialHeadline);
    setTokens(theme.tokens);
    setLogoLightRef(branding.logoLight?.storageRefId ?? null);
    setLogoDarkRef(branding.logoDark?.storageRefId ?? null);
    setFaviconRef(branding.favicon?.storageRefId ?? null);
    setErrorMessage(null);
    setStatusMessage("Unsaved changes discarded.");
  }

  async function saveBrandingDraft(overrides?: {
    logoLightRef?: string | null;
    logoDarkRef?: string | null;
    faviconRef?: string | null;
  }) {
    setBusyAction("branding");
    setErrorMessage(null);
    setStatusMessage(null);

    const lightRef = overrides?.logoLightRef ?? logoLightRef;
    const darkRef = overrides?.logoDarkRef ?? logoDarkRef;
    const favRef = overrides?.faviconRef ?? faviconRef;
    const alt = publicName.trim() || branding.publicName;

    try {
      await clientApi.put(
        "/api/v1/branding",
        {
          publicName: publicName.trim() || null,
          issuerName: issuerName.trim() || null,
          publicLandingCopy: headline.trim() ? { headline: headline.trim() } : null,
          logoLight: lightRef ? { storageRefId: lightRef, altText: alt } : null,
          logoDark: darkRef ? { storageRefId: darkRef, altText: alt } : null,
          favicon: favRef ? { storageRefId: favRef, altText: alt } : null,
        },
        "branding-update",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveThemeDraft() {
    setBusyAction("theme");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await clientApi.put("/api/v1/theme", { tokens }, "theme-update");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishBranding() {
    setBusyAction("publish");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await clientApi.post("/api/v1/branding/publish", null, "branding-publish");
      setConfirmPublish(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  function openUploadPicker(variant: LogoVariant) {
    setPendingUploadVariant(variant);
    fileInputRef.current?.click();
  }

  async function onLogoFileSelected(file: File) {
    const variant = pendingUploadVariant;
    if (!variant) return;

    setPendingUploadVariant(null);
    setBusyAction(`upload-${variant}`);
    setErrorMessage(null);

    try {
      const contentType = inferBrandingContentType(file);
      if (!contentType) {
        setErrorMessage(
          "Unsupported file type. Upload PNG, JPEG, WebP, SVG, or ICO for branding assets.",
        );
        return;
      }

      const { assetId } = await uploadBrandingAsset({
        file,
        purpose: variant === "favicon" ? "branding.favicon" : "branding.logo",
        contentType,
        ...(variant === "favicon" ? {} : { variant }),
        idempotencyPrefix: `branding-upload-${variant}`,
      });
      if (variant === "light") {
        setLogoLightRef(assetId);
        await saveBrandingDraft({ logoLightRef: assetId });
      } else if (variant === "dark") {
        setLogoDarkRef(assetId);
        await saveBrandingDraft({ logoDarkRef: assetId });
      } else {
        setFaviconRef(assetId);
        await saveBrandingDraft({ faviconRef: assetId });
      }
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onLogoFileSelected(file);
        }}
      />

      <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            Branding &amp; Theme
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Configure white-label identity, preview changes, and publish to production.
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          Last saved {formatRelativeUpdatedAt(lastSavedAt)}
        </p>
      </header>

      <BrandingAnimatedCollapsible open={Boolean(statusMessage)} id="branding-status-banner">
        {statusMessage ? (
          <p
            role="status"
            className={`${statusBannerClassName} border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 text-[var(--admin-success)]`}
          >
            {statusMessage}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <BrandingAnimatedCollapsible
        open={Boolean(errorMessage)}
        id="branding-error-banner"
        noTopMargin={!statusMessage}
      >
        {errorMessage ? (
          <p
            role="alert"
            className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {errorMessage}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <div className="grid grid-cols-1 gap-8 pb-32 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-7">
          <section className={cardClassName}>
            <div className={`${cardHeaderClassName} items-start`}>
              <div className="min-w-0 flex-1">
                <h2 className={sectionTitleClassName}>Identity &amp; Copy</h2>
                <p className={sectionDescClassName}>
                  Define the global naming for your academy instance.
                </p>
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  void saveBrandingDraft();
                }}
                className={outlineButtonClassName}
              >
                {busyAction === "branding" ? "Saving…" : "Save draft"}
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="branding-public-name" className={labelClassName}>
                    Academy name
                  </label>
                  <input
                    id="branding-public-name"
                    className={fieldClassName}
                    value={publicName}
                    onChange={(event) => {
                      setPublicName(event.target.value);
                    }}
                    placeholder="Your academy name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="branding-issuer-name" className={labelClassName}>
                    Issuer name
                  </label>
                  <input
                    id="branding-issuer-name"
                    className={fieldClassName}
                    value={issuerName}
                    onChange={(event) => {
                      setIssuerName(event.target.value);
                    }}
                    placeholder="Your issuer name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="branding-headline" className={labelClassName}>
                  Landing headline
                </label>
                <textarea
                  id="branding-headline"
                  rows={2}
                  className={`${fieldClassName} resize-none`}
                  value={headline}
                  onChange={(event) => {
                    setHeadline(event.target.value);
                  }}
                  placeholder="Master the markets with institutional-grade education."
                />
              </div>
            </div>
          </section>

          <section className={cardClassName}>
            <div className={cardHeaderClassName}>
              <div>
                <h2 className={sectionTitleClassName}>Logo assets</h2>
                <p className={sectionDescClassName}>
                  Upload variants for light, dark, and favicon contexts.
                </p>
              </div>
            </div>
            <div className="space-y-3 p-6">
              <LogoAssetRow
                title="Light mode logo"
                subtitle="Recommended: SVG or 400×100px PNG"
                configured={Boolean(logoLightRef)}
                monogram={publicName.trim().slice(0, 2).toUpperCase() || "FB"}
                busy={busyAction === "upload-light"}
                dashed={false}
                onUpload={() => {
                  openUploadPicker("light");
                }}
              />
              <LogoAssetRow
                title="Dark mode logo"
                subtitle={logoDarkRef ? "Configured" : "Not configured yet"}
                configured={Boolean(logoDarkRef)}
                monogram={null}
                busy={busyAction === "upload-dark"}
                dashed={!logoDarkRef}
                onUpload={() => {
                  openUploadPicker("dark");
                }}
              />
              {faviconRef ? (
                <LogoAssetRow
                  title="Favicon"
                  subtitle="Configured"
                  configured
                  monogram={publicName.trim().slice(0, 2).toUpperCase() || "FB"}
                  busy={busyAction === "upload-favicon"}
                  dashed={false}
                  onUpload={() => {
                    openUploadPicker("favicon");
                  }}
                  onClear={() => {
                    setFaviconRef(null);
                    void saveBrandingDraft({ faviconRef: null });
                  }}
                />
              ) : (
                <LogoAssetRow
                  title="Favicon"
                  subtitle="32×32px ICO or PNG"
                  configured={false}
                  monogram={publicName.trim().slice(0, 2).toUpperCase() || "FB"}
                  busy={busyAction === "upload-favicon"}
                  dashed={false}
                  onUpload={() => {
                    openUploadPicker("favicon");
                  }}
                />
              )}
            </div>
          </section>

          <Link
            href="/admin/branding/about-school"
            prefetch={false}
            className={`group flex items-center gap-4 p-6 ${cardClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]">
              <School className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-[var(--admin-on-surface)]">
                About School
              </span>
              <span className="mt-0.5 block text-sm text-[var(--admin-on-surface-variant)]">
                Add school details, image, and social links for your public page.
              </span>
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--admin-on-surface)]"
              aria-hidden="true"
            />
          </Link>

          <ThemeTokenEditor
            theme={theme}
            tokens={tokens}
            onTokensChange={setTokens}
            onSave={saveThemeDraft}
            busy={busyAction === "theme"}
          />

          <BrandingAnimatedCollapsible open={pendingCount > 0} id="branding-pending-changes">
            {pendingCount > 0 ? (
              <section className={pendingPanelClassName}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className={sectionTitleClassName}>Pending changes</h3>
                  <span className="rounded-full bg-[var(--admin-primary-container)] px-2.5 py-0.5 text-xs font-bold text-[var(--admin-on-primary-container)]">
                    {pendingCount} update{pendingCount === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {brandingDirtyItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Edit3
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                  {themeDiff.map((entry) => (
                    <li key={entry.key} className="flex items-start gap-2">
                      <Type
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      <span>
                        {formatThemeTokenLabel(entry.key)}:{" "}
                        <code className="line-through opacity-60">
                          {entry.before ?? EMPTY_TOKEN_VALUE}
                        </code>
                        {" → "}
                        <code className="font-semibold text-[var(--admin-on-surface)]">
                          {entry.after ?? EMPTY_TOKEN_VALUE}
                        </code>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </BrandingAnimatedCollapsible>

          {children}
        </div>

        <div className="lg:col-span-5">
          <div className={previewStickyClassName}>
            <BrandPreview branding={previewBranding} theme={previewTheme} />
          </div>
        </div>
      </div>

      <footer className="admin-glass fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--admin-border)] px-4 py-4 motion-safe:animate-[admin-slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)] lg:left-[280px] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                Ready to push live?
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {pendingCount > 0
                  ? `Review ${String(pendingCount)} pending change${pendingCount === 1 ? "" : "s"} before publishing.`
                  : "Save drafts first if you have unpublished edits."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busyAction !== null || pendingCount === 0}
              onClick={discardChanges}
              className={ghostButtonClassName}
            >
              Discard changes
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                setConfirmPublish(true);
              }}
              className={primaryButtonClassName}
            >
              {busyAction === "publish" ? "Publishing…" : "Publish changes"}
            </button>
          </div>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmPublish}
        title="Publish branding and theme?"
        description="This updates the live tenant experience for all visitors and learners."
        confirmLabel="Publish"
        busy={busyAction === "publish"}
        onConfirm={() => {
          void publishBranding();
        }}
        onCancel={() => {
          setConfirmPublish(false);
        }}
      />
    </>
  );
}

function LogoAssetRow({
  title,
  subtitle,
  configured,
  monogram,
  busy,
  dashed,
  onUpload,
  onClear,
}: {
  title: string;
  subtitle: string;
  configured: boolean;
  monogram: string | null;
  busy: boolean;
  dashed: boolean;
  onUpload: () => void;
  onClear?: () => void;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-lg p-4 motion-safe:transition-[background-color,border-color] motion-safe:duration-200 sm:flex-row sm:items-center sm:justify-between",
        dashed
          ? "border border-dashed border-[var(--admin-border)]"
          : "bg-[var(--admin-surface-low)]",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] motion-safe:transition-opacity motion-safe:duration-200",
            configured ? "bg-[var(--admin-surface)]" : "bg-[var(--admin-surface-high)]",
            busy ? "opacity-60" : "",
          ].join(" ")}
        >
          {busy ? (
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--admin-primary)]"
              aria-hidden="true"
            />
          ) : configured && monogram ? (
            <span className="text-lg font-bold text-[var(--admin-primary)]">{monogram}</span>
          ) : (
            <ImageIcon
              className="h-5 w-5 text-[var(--admin-on-surface-variant)] opacity-40"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{title}</p>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        {onClear ? (
          <button
            type="button"
            aria-label={`Remove ${title}`}
            onClick={onClear}
            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-danger)]"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return `${error.message} (${error.code})`;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}
