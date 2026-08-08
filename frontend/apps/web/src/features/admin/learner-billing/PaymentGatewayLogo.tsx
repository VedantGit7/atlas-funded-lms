"use client";

import { useState } from "react";

const ACCENT_TOKENS = [
  "--admin-lesson-video",
  "--admin-lesson-audio",
  "--admin-lesson-pdf",
  "--admin-lesson-slides",
  "--admin-lesson-live",
  "--admin-lesson-scorm",
  "--admin-lesson-quiz",
  "--admin-lesson-assignment",
  "--admin-primary",
];

function accentFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ACCENT_TOKENS[hash % ACCENT_TOKENS.length] ?? "--admin-primary";
}

function initialsOf(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0] ?? name).slice(0, 2).toUpperCase();
}

/**
 * Renders a bundled brand logo from /payment-logos/<key>.svg (the industry
 * standard: local, offline, brand-guideline compliant). Falls back to a themed
 * monogram tile when no logo asset is bundled for that gateway.
 */
export function PaymentGatewayLogo({
  gatewayKey,
  name,
  size = 40,
}: {
  gatewayKey: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const accent = accentFor(gatewayKey);

  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          backgroundColor: `color-mix(in srgb, var(${accent}) 16%, var(--admin-surface))`,
          color: `var(${accent})`,
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-lg text-xs font-bold"
      >
        {initialsOf(name)}
      </span>
    );
  }

  // Brand logos render on a theme-stable light chip so brand colors stay legible
  // in both light and dark mode (the payment-logo industry convention).
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--admin-certificate-paper)] p-1.5 ring-1 ring-inset ring-[var(--admin-border)]"
    >
      <img
        src={`/payment-logos/${gatewayKey}.svg`}
        alt=""
        loading="lazy"
        onError={() => {
          setFailed(true);
        }}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
