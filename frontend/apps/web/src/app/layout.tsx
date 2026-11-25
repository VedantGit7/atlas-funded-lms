import type { Metadata } from "next";
import { headers } from "next/headers";

import "./globals.css";
import "../styles/cormorant-garamond.css";
import "../styles/plus-jakarta-sans.css";
import "../styles/jetbrains-mono.css";
import "../styles/manrope.css";
import "../styles/ibm-plex-mono.css";
import "../styles/skins/sky-glass.css";

import { AppProviders } from "@/components/providers/AppProviders";
import { AnalyticsConsentBridge } from "../observability/AnalyticsConsentBridge";
import { BrowserSentryStarter } from "../observability/BrowserSentryStarter";
import { LazyMarketingSnippets } from "../features/marketing/LazyMarketingSnippets";
import { loadTenantThemeRuntime } from "@atlas/tenant-theme";
import { ThemeInitScript } from "../components/ThemeInitScript";
import { resolveDocumentDescription, resolveDocumentTitle } from "../lib/branding/document-title";
import { pageDocumentTitle } from "../lib/branding/page-title";
import { loadPublicBootstrap } from "../lib/server/bootstrap";
import { resolveAppearanceHtmlProps } from "../lib/server/resolve-appearance-html";
import { hasSessionCookie } from "../lib/server/has-session-cookie";
import { loadAcademyFormat } from "../lib/format/load-academy-format";

/**
 * Derives the tab title from the resolved tenant.
 * Tenant hosts → "{TenantName} LMS". Platform host → "Atlas LMS".
 * Uses shared resolveDocumentTitle so admin/learner titles stay consistent.
 */
export async function generateMetadata(): Promise<Metadata> {
  let title = resolveDocumentTitle({});
  let description = resolveDocumentDescription({});
  let faviconUrl: string | null = null;

  try {
    const bootstrap = await loadPublicBootstrap();
    title = resolveDocumentTitle(bootstrap);
    description = resolveDocumentDescription(bootstrap);
    faviconUrl = bootstrap.faviconUrl;
  } catch {
    // No resolvable tenant (e.g. the base Atlas host): keep the product defaults.
  }

  // Pages without a title of their own are named after their menu entry (QA review 1 m1).
  const pathname = (await headers()).get("x-atlas-pathname") ?? "";
  return {
    title: {
      default: pageDocumentTitle(pathname, title),
      template: `%s · ${title}`,
    },
    description,
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
  };
}

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  // Request headers opt the root into dynamic rendering; never cache nonce HTML.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const hasSession = await hasSessionCookie();
  const theme = await loadTenantThemeRuntime();
  // The Sky Glass skin brings its own fonts; other academies never load them.
  const skyGlass = theme.skin === "sky-glass";
  const baseClassName = `font-plus-jakarta-sans font-cormorant font-jetbrains-mono${
    skyGlass ? " font-manrope font-plex-mono" : ""
  }`;
  const appearance = await resolveAppearanceHtmlProps(
    baseClassName,
    theme.style ?? undefined,
    theme.modeDefault,
  );

  let displayCurrency: string | null = null;
  let fxRates: Record<string, number> | null = null;
  // Route-level `loading.tsx` files are Suspense fallbacks: they must render
  // immediately and cannot await branding, and making them async would suspend
  // the fallback itself. Publishing the tenant's mark as a CSS custom property
  // here lets `BrandLoadingScreen` show it with no data fetch of its own —
  // which is why the FundedBeyond loading screen was blank.
  const brandingStyle: Record<string, string> = {};
  const academyFormat = await loadAcademyFormat();
  try {
    const bootstrap = await loadPublicBootstrap();
    displayCurrency = bootstrap.homeCurrency;
    fxRates = bootstrap.fxRates;

    const logoUrl = bootstrap.logoLightUrl ?? bootstrap.logoDarkUrl;
    if (logoUrl) {
      // CSS url() token: the value is a tenant-controlled URL, so quote it and
      // reject the characters that could break out of the declaration.
      if (!/["'()\\\s]/.test(logoUrl)) {
        brandingStyle["--tenant-logo-url"] = `url("${logoUrl}")`;
      }
    }
  } catch {
    // No resolvable tenant: currency conversion falls back to native amounts,
    // and the loading screen falls back to its unbranded spinner.
  }

  return (
    <html
      lang="en"
      data-skin={theme.skin}
      className={appearance.className}
      style={{ ...appearance.style, ...brandingStyle }}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/fonts/plus-jakarta-sans/v12/normal-latin.cd8db90cd950.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/jetbrains-mono/v24/normal-latin.2c32b9b3ee35.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cormorant-garamond/v21/normal-latin.5d618c462b7a.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cormorant-garamond/v21/italic-latin.e6d6d1d73858.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {skyGlass ? (
          <>
            <link
              rel="preload"
              href="/fonts/manrope/v1/normal-latin.e310b55a7fd9.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
            <link
              rel="preload"
              href="/fonts/ibm-plex-mono/v1/normal-400-latin.c36f509c0a8f.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
            <link
              rel="preload"
              href="/fonts/ibm-plex-mono/v1/normal-500-latin.a76f53ca6612.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
            <link
              rel="preload"
              href="/fonts/ibm-plex-mono/v1/normal-600-latin.ad4580d8cb4b.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
          </>
        ) : null}
        <ThemeInitScript {...(nonce ? { nonce } : {})} tenantModeDefault={theme.modeDefault} />
      </head>
      <body suppressHydrationWarning>
        <AppProviders
          initialDisplayCurrency={displayCurrency}
          initialFxRates={fxRates}
          academyFormat={academyFormat}
        >
          <AnalyticsConsentBridge hasSession={hasSession}>
            <LazyMarketingSnippets />
            <BrowserSentryStarter />
            {children}
          </AnalyticsConsentBridge>
        </AppProviders>
      </body>
    </html>
  );
}
