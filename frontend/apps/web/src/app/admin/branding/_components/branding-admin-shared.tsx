import type { ReactNode } from "react";
import { clientApi } from "../../../../lib/client-api";

export const collapseEase = "cubic-bezier(0.4, 0, 0.2, 1)";

export const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const selectClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const labelClassName = "text-[13px] font-medium text-[var(--admin-on-surface-variant)]";

export const cardClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm motion-safe:transition-[box-shadow,border-color] motion-safe:duration-300 hover:shadow-md";

export const cardHeaderClassName =
  "flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-4";

export const sectionTitleClassName = "text-lg font-semibold text-[var(--admin-on-surface)]";

export const sectionDescClassName =
  "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";

export const outlineButtonClassName =
  "shrink-0 rounded-lg border border-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-primary-container)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClassName =
  "px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const pendingPanelClassName =
  "rounded-xl border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,var(--admin-surface))] p-6 motion-safe:animate-[admin-slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)]";

export const previewStickyClassName = "lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-7rem)]";

export const statusBannerClassName =
  "rounded-lg border px-4 py-3 text-sm motion-safe:animate-[admin-banner-in_0.25s_ease-out]";

export function formatRelativeUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffHours, "hour");
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffDays, "day");
}

export const RADIUS_PX: Record<"none" | "sm" | "md" | "lg" | "xl", number> = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

const BRANDING_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

export function inferBrandingContentType(file: File): string | null {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type.toLowerCase();
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BRANDING_MIME_BY_EXTENSION[extension] ?? null;
}

export type BrandingAssetPurpose = "branding.logo" | "branding.favicon" | "branding.og-image";

/**
 * Upload a branding image: get a signed URL, PUT the file, then confirm it so
 * the server checks the bytes (and sanitizes an SVG) before the asset can be
 * used (audit M8). Without the confirm the asset never becomes usable.
 */
export async function uploadBrandingAsset(args: {
  file: File;
  purpose: BrandingAssetPurpose;
  contentType: string;
  variant?: "light" | "dark";
  idempotencyPrefix: string;
}): Promise<{ assetId: string; url: string | null }> {
  const signed = await clientApi.post<{
    data: {
      asset: { id: string };
      upload: { url: string; requiredHeaders: Record<string, string> };
    };
  }>(
    "/api/v1/branding/assets/upload",
    {
      purpose: args.purpose,
      fileName: args.file.name,
      contentType: args.contentType,
      sizeBytes: args.file.size,
      ...(args.variant ? { variant: args.variant } : {}),
    },
    args.idempotencyPrefix,
    { silent: true },
  );

  const stored = await fetch(signed.data.upload.url, {
    method: "PUT",
    headers: signed.data.upload.requiredHeaders,
    body: args.file,
  });
  if (!stored.ok) {
    throw new Error("The file could not be uploaded. Please try again.");
  }

  const confirmed = await clientApi.post<{
    data: { asset: { id: string }; url: string | null };
  }>(
    "/api/v1/branding/assets/confirm",
    { assetReferenceId: signed.data.asset.id },
    `${args.idempotencyPrefix}-confirm`,
  );
  return { assetId: confirmed.data.asset.id, url: confirmed.data.url };
}

const RADIUS_KEYS = ["none", "sm", "md", "lg", "xl"] as const;

export function radiusFromPx(px: number): (typeof RADIUS_KEYS)[number] {
  let closest: (typeof RADIUS_KEYS)[number] = "none";
  for (const key of RADIUS_KEYS) {
    if (Math.abs(RADIUS_PX[key] - px) < Math.abs(RADIUS_PX[closest] - px)) {
      closest = key;
    }
  }
  return closest;
}

export function BrandingAnimatedCollapsible({
  open,
  id,
  children,
  className = "",
  noTopMargin = false,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
  className?: string;
  noTopMargin?: boolean;
}) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      style={{ transitionTimingFunction: collapseEase }}
      className={[
        "grid motion-safe:transition-[grid-template-rows,margin-top,opacity] motion-safe:duration-300",
        open
          ? noTopMargin
            ? "mt-0 grid-rows-[1fr] opacity-100"
            : "mt-3 grid-rows-[1fr] opacity-100"
          : "mt-0 grid-rows-[0fr] opacity-0",
        className,
      ].join(" ")}
    >
      <div className={["min-h-0 overflow-hidden", open ? "" : "pointer-events-none"].join(" ")}>
        <div
          style={{ transitionTimingFunction: collapseEase }}
          className={[
            "motion-safe:transition-[transform,opacity] motion-safe:duration-300",
            open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function BrandingSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const activeIndex = options.findIndex((option) => option.id === value);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="relative flex rounded-lg bg-[var(--admin-surface-low)] p-1"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 top-1 rounded-md bg-[var(--admin-surface)] shadow-sm motion-safe:transition-[left,width] motion-safe:duration-300"
        style={{
          left: `calc(${activeIndex} * (100% / ${options.length}) + 0.25rem)`,
          width: `calc(100% / ${options.length} - 0.5rem)`,
          transitionTimingFunction: collapseEase,
        }}
      />
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(option.id);
            }}
            className={[
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold motion-safe:transition-colors motion-safe:duration-200",
              active
                ? "text-[var(--admin-on-surface)]"
                : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              option.label ? "" : "px-2",
            ].join(" ")}
          >
            {option.icon}
            {option.label ? <span>{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
