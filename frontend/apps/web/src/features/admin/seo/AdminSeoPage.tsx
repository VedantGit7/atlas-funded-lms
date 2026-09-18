"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  ghostButtonClassName,
  inferBrandingContentType,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  seoDirtyBadgeClassName,
  seoFieldBlockClassName,
  seoFieldHelperClassName,
  seoFieldLabelClassName,
  seoFieldStackClassName,
  seoImagePreviewClassName,
  seoPageClassName,
  seoTextareaClassName,
} from "./seo-admin-shared";

const META_DESCRIPTION_MAX = 5000;
const META_KEYWORDS_MAX = 2000;

export type TenantSeoState = {
  metaDescription: string;
  metaKeywords: string;
  metaImageRefId: string | null;
  metaImageUrl: string | null;
};

type AdminSeoPageProps = {
  initialSeo: TenantSeoState;
};

type TenantSeoResponse = {
  data: TenantSeoState;
};

function formsEqual(left: TenantSeoState, right: TenantSeoState): boolean {
  return (
    left.metaDescription === right.metaDescription &&
    left.metaKeywords === right.metaKeywords &&
    left.metaImageRefId === right.metaImageRefId
  );
}

export function AdminSeoPage({ initialSeo }: AdminSeoPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [seo, setSeo] = useState<TenantSeoState>(initialSeo);
  const [savedSeo, setSavedSeo] = useState<TenantSeoState>(initialSeo);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const isDirty = !formsEqual(seo, savedSeo);

  async function handleSave() {
    if (busy || !isDirty) return;
    setBusy(true);
    setMessage(null);
    setErrorRequestId(null);

    try {
      const response = await clientApi.put<TenantSeoResponse>(
        "/api/v1/tenant-settings/seo",
        {
          metaDescription: seo.metaDescription,
          metaKeywords: seo.metaKeywords,
          metaImageRefId: seo.metaImageRefId,
        },
        "tenant-seo-update",
      );
      setSavedSeo(response.data);
      setSeo(response.data);
      setMessage("SEO settings saved.");
    } catch (error) {
      if (error instanceof ClientApiError) {
        setMessage(error.message);
        setErrorRequestId(error.requestId);
      } else {
        setMessage("Unable to save SEO settings.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleImageSelected(file: File) {
    setUploadBusy(true);
    setMessage(null);
    setErrorRequestId(null);

    try {
      const contentType = inferBrandingContentType(file);
      if (!contentType) {
        setMessage("Unsupported file type. Upload PNG, JPEG, WebP, or SVG.");
        return;
      }

      const uploadResponse = await clientApi.post<{
        data: {
          asset: { id: string };
          upload: { url: string; requiredHeaders: Record<string, string> };
        };
      }>(
        "/api/v1/branding/assets/upload",
        {
          purpose: "branding.og-image",
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
        },
        "seo-meta-image-upload",
      );

      await fetch(uploadResponse.data.upload.url, {
        method: "PUT",
        headers: uploadResponse.data.upload.requiredHeaders,
        body: file,
      });

      const previewUrl = URL.createObjectURL(file);
      setSeo((current) => ({
        ...current,
        metaImageRefId: uploadResponse.data.asset.id,
        metaImageUrl: previewUrl,
      }));
    } catch (error) {
      if (error instanceof ClientApiError) {
        setMessage(error.message);
        setErrorRequestId(error.requestId);
      } else {
        setMessage("Unable to upload meta image.");
      }
    } finally {
      setUploadBusy(false);
    }
  }

  const disabled = busy || uploadBusy;

  return (
    <div className={seoPageClassName}>
      <Link href="/admin/settings" prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              SEO
            </h1>
            {isDirty ? <span className={seoDirtyBadgeClassName}>Not saved</span> : null}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Manage the SEO settings to improve your website ranking on search engines.
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={disabled || !isDirty}
          onClick={() => {
            void handleSave();
          }}
        >
          {busy ? "Updating…" : "Update"}
        </button>
      </div>

      <div className={seoFieldStackClassName}>
        <div className={seoFieldBlockClassName}>
          <label htmlFor="seo-meta-description" className={seoFieldLabelClassName}>
            Meta Description
          </label>
          <p className={seoFieldHelperClassName}>
            This description will be shown on lists and pages that don&apos;t have meta description.
          </p>
          <textarea
            id="seo-meta-description"
            value={seo.metaDescription}
            maxLength={META_DESCRIPTION_MAX}
            disabled={disabled}
            placeholder="Meta Description"
            className={seoTextareaClassName}
            onChange={(event) => {
              setSeo((current) => ({ ...current, metaDescription: event.target.value }));
              setMessage(null);
            }}
          />
        </div>

        <div className={seoFieldBlockClassName}>
          <label htmlFor="seo-meta-keywords" className={seoFieldLabelClassName}>
            Meta Keywords
          </label>
          <p className={seoFieldHelperClassName}>
            Comma separated keywords for search engines to find your website.
          </p>
          <textarea
            id="seo-meta-keywords"
            value={seo.metaKeywords}
            maxLength={META_KEYWORDS_MAX}
            disabled={disabled}
            placeholder="Meta Keywords"
            className={seoTextareaClassName}
            onChange={(event) => {
              setSeo((current) => ({ ...current, metaKeywords: event.target.value }));
              setMessage(null);
            }}
          />
        </div>

        <div className={seoFieldBlockClassName}>
          <p className={seoFieldLabelClassName}>Meta Image</p>
          <p className={seoFieldHelperClassName}>
            Default social-share image used when pages lack their own meta image.
          </p>
          {seo.metaImageUrl ? (
            <div className={seoImagePreviewClassName}>
              <img
                src={seo.metaImageUrl}
                alt="SEO meta preview"
                className="max-h-48 w-full object-cover"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={outlineButtonClassName}
              disabled={disabled}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {uploadBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Uploading…
                </span>
              ) : (
                "Upload an image"
              )}
            </button>
            {seo.metaImageRefId ? (
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={disabled}
                onClick={() => {
                  setSeo((current) => ({
                    ...current,
                    metaImageRefId: null,
                    metaImageUrl: null,
                  }));
                }}
              >
                Remove image
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void handleImageSelected(file);
              }
            }}
          />
        </div>
      </div>

      {message ? (
        <p
          role="status"
          className={[
            "text-sm",
            errorRequestId ? "text-[var(--admin-danger)]" : "text-[var(--admin-success)]",
          ].join(" ")}
        >
          {message}
          {errorRequestId ? ` Request ID: ${errorRequestId}` : null}
        </p>
      ) : null}
    </div>
  );
}
