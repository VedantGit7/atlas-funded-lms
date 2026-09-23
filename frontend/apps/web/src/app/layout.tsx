import type { Metadata } from "next";
import { headers } from "next/headers";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import "../styles/cormorant-garamond.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains",
});
import { AppProviders } from "@/components/providers/AppProviders";
import { AnalyticsConsentBridge } from "../observability/AnalyticsConsentBridge";
import { MarketingSnippetsInjector } from "../features/marketing/MarketingSnippetsInjector";
import { loadTenantThemeRuntime } from "@atlas/tenant-theme";
import { ThemeInitScript } from "../components/ThemeInitScript";
import { resolveDocumentDescription, resolveDocumentTitle } from "../lib/branding/document-title";
import { loadPublicBootstrap } from "../lib/server/bootstrap";
import { resolveAppearanceHtmlProps } from "../lib/server/resolve-appearance-html";

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

  return {
    title: {
      default: title,
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
  const theme = await loadTenantThemeRuntime();
  const baseClassName = `${jakarta.variable} font-cormorant ${jetbrainsMono.variable}`;
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
      className={appearance.className}
      style={{ ...appearance.style, ...brandingStyle }}
      suppressHydrationWarning
    >
      <head>
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
        <ThemeInitScript {...(nonce ? { nonce } : {})} tenantModeDefault={theme.modeDefault} />
      </head>
      <body suppressHydrationWarning>
        <AppProviders initialDisplayCurrency={displayCurrency} initialFxRates={fxRates}>
          <AnalyticsConsentBridge>
            <MarketingSnippetsInjector />
            {children}
          </AnalyticsConsentBridge>
        </AppProviders>
      </body>
    </html>
  );
}
