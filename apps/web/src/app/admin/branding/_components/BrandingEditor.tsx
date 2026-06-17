"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import type { TenantBrandingViewSchema } from "@atlas/domain-branding/schemas/branding";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

type BrandingView = z.infer<typeof TenantBrandingViewSchema>;
type ThemeView = z.infer<typeof TenantThemeViewSchema>;

type BrandingEditorProps = {
  branding: BrandingView;
  theme: ThemeView;
};

export function BrandingEditor({ branding, theme }: BrandingEditorProps) {
  const router = useRouter();
  const [publicName, setPublicName] = useState(branding.publicName ?? "");
  const [issuerName, setIssuerName] = useState(branding.issuerName ?? "");
  const [headline, setHeadline] = useState(
    typeof branding.publicLandingCopy?.["headline"] === "string"
      ? branding.publicLandingCopy["headline"]
      : "",
  );
  const [primary, setPrimary] = useState(theme.tokens.primary);
  const [accent, setAccent] = useState(theme.tokens.accent ?? "#8899aa");
  const [header, setHeader] = useState(theme.tokens.header ?? "#112233");
  const [background, setBackground] = useState(theme.tokens.background ?? "#ffffff");
  const [foreground, setForeground] = useState(theme.tokens.foreground ?? "#101010");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function saveBrandingDraft() {
    setBusyAction("branding");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await clientApi.put(
        "/api/v1/branding",
        {
          publicName: publicName.trim() || null,
          issuerName: issuerName.trim() || null,
          publicLandingCopy: headline.trim() ? { headline: headline.trim() } : null,
        },
        "branding-update",
      );
      setStatusMessage("Branding draft saved.");
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
      await clientApi.put(
        "/api/v1/theme",
        {
          tokens: {
            primary,
            accent,
            header,
            background,
            foreground,
            radius: theme.tokens.radius,
            modeDefault: theme.tokens.modeDefault,
          },
        },
        "theme-update",
      );
      setStatusMessage("Theme draft saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishBranding() {
    if (!window.confirm("Publish branding and theme to the live tenant experience?")) {
      return;
    }

    setBusyAction("publish");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await clientApi.post("/api/v1/branding/publish", null, "branding-publish");
      setStatusMessage("Branding and theme published.");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section aria-label="Branding and theme editor">
      <p>
        Draft status: <strong>{branding.status}</strong> · Branding v{branding.version} · Theme v
        {theme.version}
      </p>

      <fieldset>
        <legend>Branding copy</legend>
        <label>
          Public name
          <input
            type="text"
            value={publicName}
            onChange={(event) => {
              setPublicName(event.target.value);
            }}
          />
        </label>
        <label>
          Issuer name
          <input
            type="text"
            value={issuerName}
            onChange={(event) => {
              setIssuerName(event.target.value);
            }}
          />
        </label>
        <label>
          Landing headline
          <input
            type="text"
            value={headline}
            onChange={(event) => {
              setHeadline(event.target.value);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void saveBrandingDraft();
          }}
          disabled={busyAction !== null}
        >
          {busyAction === "branding" ? "Saving branding…" : "Save branding draft"}
        </button>
      </fieldset>

      <fieldset>
        <legend>Theme tokens</legend>
        <label>
          Primary
          <input
            type="color"
            value={primary}
            onChange={(event) => {
              setPrimary(event.target.value);
            }}
          />
        </label>
        <label>
          Accent
          <input
            type="color"
            value={accent}
            onChange={(event) => {
              setAccent(event.target.value);
            }}
          />
        </label>
        <label>
          Header
          <input
            type="color"
            value={header}
            onChange={(event) => {
              setHeader(event.target.value);
            }}
          />
        </label>
        <label>
          Background
          <input
            type="color"
            value={background}
            onChange={(event) => {
              setBackground(event.target.value);
            }}
          />
        </label>
        <label>
          Foreground
          <input
            type="color"
            value={foreground}
            onChange={(event) => {
              setForeground(event.target.value);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void saveThemeDraft();
          }}
          disabled={busyAction !== null}
        >
          {busyAction === "theme" ? "Saving theme…" : "Save theme draft"}
        </button>
      </fieldset>

      <button
        type="button"
        onClick={() => {
          void publishBranding();
        }}
        disabled={busyAction !== null}
      >
        {busyAction === "publish" ? "Publishing…" : "Publish branding and theme"}
      </button>

      {statusMessage ? (
        <p role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </section>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
