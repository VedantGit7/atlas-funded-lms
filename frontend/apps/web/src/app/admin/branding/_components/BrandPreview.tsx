"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { z } from "zod";
import { TenantLogo } from "@atlas/design-system";
import type { TenantBrandingViewSchema } from "@atlas/domain-branding/schemas/branding";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";
import { mapTenantThemeToSemanticPayload } from "@atlas/domain-branding/utils/theme-semantic-tokens";
import { BrandingSegmentedControl } from "./branding-admin-shared";

type BrandingView = z.infer<typeof TenantBrandingViewSchema>;
type ThemeView = z.infer<typeof TenantThemeViewSchema>;

type BrandPreviewProps = {
  branding: BrandingView;
  theme: ThemeView;
};

export function BrandPreview({ branding, theme }: BrandPreviewProps) {
  const defaultMode = theme.tokens.modeDefault === "dark" ? "dark" : "light";
  const [previewMode, setPreviewMode] = useState<"light" | "dark">(defaultMode);
  const semantic = mapTenantThemeToSemanticPayload(theme.tokens);
  const headline =
    typeof branding.publicLandingCopy?.["headline"] === "string"
      ? branding.publicLandingCopy["headline"]
      : "Your academy headline appears here.";

  useEffect(() => {
    if (theme.tokens.modeDefault !== "system") {
      setPreviewMode(theme.tokens.modeDefault === "dark" ? "dark" : "light");
    }
  }, [theme.tokens.modeDefault]);

  const bg = previewMode === "dark" ? "#1A1714" : semantic.color.background ?? "#FFFDF9";
  const fg = previewMode === "dark" ? "#F0EEF8" : semantic.color.foreground ?? "#1A1714";
  const headerBg =
    previewMode === "dark" ? "#000000" : semantic.color.header ?? semantic.color.primary ?? "#1A1714";
  const primary = semantic.color.primary ?? "#3730A3";
  const radiusPx =
    theme.tokens.radius === "none"
      ? 0
      : theme.tokens.radius === "sm"
        ? 4
        : theme.tokens.radius === "md"
          ? 8
          : theme.tokens.radius === "lg"
            ? 12
            : 16;

  const issuerLabel = branding.issuerName?.trim() || "Issuer name";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg motion-safe:transition-shadow motion-safe:duration-300 hover:shadow-xl">
        <div className="admin-glass flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[var(--admin-danger)]" />
            <span className="h-3 w-3 rounded-full bg-[var(--admin-warning)]" />
            <span className="h-3 w-3 rounded-full bg-[var(--admin-success)]" />
          </div>
          <div className="max-w-[12rem] truncate rounded-md bg-[var(--admin-surface-low)] px-4 py-1 text-center text-[11px] text-[var(--admin-on-surface-variant)]">
            academy.yourtenant.com
          </div>
          <div className="w-[88px]">
            <BrandingSegmentedControl
              value={previewMode}
              ariaLabel="Preview appearance"
              options={[
                { id: "light", label: "", icon: <Sun className="h-3.5 w-3.5" aria-hidden="true" /> },
                { id: "dark", label: "", icon: <Moon className="h-3.5 w-3.5" aria-hidden="true" /> },
              ]}
              onChange={setPreviewMode}
            />
          </div>
        </div>

        <div
          className="aspect-[4/5] max-h-[min(560px,70vh)] overflow-y-auto motion-safe:transition-[background-color,color] motion-safe:duration-300"
          style={{ backgroundColor: bg, color: fg }}
        >
          <nav
            className="flex items-center justify-between px-4 py-3 motion-safe:transition-[background-color] motion-safe:duration-300"
            style={{ backgroundColor: headerBg }}
          >
            <div className="text-white">
              <TenantLogo
                publicName={branding.publicName ?? branding.displayName}
                className="text-white"
              />
            </div>
            <div className="flex gap-2">
              <span className="h-3 w-12 rounded-full bg-white/10" />
              <span className="h-3 w-12 rounded-full bg-white/10" />
            </div>
          </nav>

          <div className="space-y-6 px-6 py-10 text-center">
            <span
              className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider motion-safe:transition-[background-color,color] motion-safe:duration-300"
              style={{ backgroundColor: `${primary}1A`, color: primary }}
            >
              Trusted academy
            </span>
            <h2
              key={headline}
              className="px-2 text-2xl font-bold leading-tight tracking-tight motion-safe:animate-[admin-banner-in_0.3s_ease-out]"
              style={{ color: fg }}
            >
              {headline}
            </h2>
            <p className="px-4 text-sm opacity-80">
              {issuerLabel} · premium learning for your members.
            </p>
            <button
              type="button"
              disabled
              className="w-full px-6 py-3 text-sm font-semibold text-white shadow-lg motion-safe:transition-[background-color,box-shadow,border-radius] motion-safe:duration-300"
              style={{
                backgroundColor: primary,
                borderRadius: radiusPx,
                boxShadow: `0 10px 25px ${primary}33`,
              }}
            >
              Enroll now
            </button>
            <div className="mt-8 grid grid-cols-2 gap-2">
              {[0, 1].map((slot) => (
                <div
                  key={slot}
                  className="rounded-lg p-4 motion-safe:transition-[background-color,border-radius] motion-safe:duration-300"
                  style={{
                    backgroundColor: previewMode === "dark" ? "#2A2840" : `${primary}0D`,
                    borderRadius: radiusPx,
                  }}
                >
                  <div
                    className="mb-2 h-8 w-8 rounded-full motion-safe:transition-[background-color] motion-safe:duration-300"
                    style={{ backgroundColor: `${primary}33` }}
                  />
                  <div
                    className="h-2 w-12 rounded motion-safe:transition-[background-color] motion-safe:duration-300"
                    style={{ backgroundColor: `${fg}33` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
        Live preview. Changes reflect instantly.
      </p>
    </div>
  );
}
