import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
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
  const theme = await loadTenantThemeRuntime();
  const baseClassName = `${jakarta.variable} ${cormorant.variable} ${jetbrainsMono.variable}`;
  const appearance = await resolveAppearanceHtmlProps(
    baseClassName,
    theme.style ?? undefined,
    theme.modeDefault,
  );

  let displayCurrency: string | null = null;
  let fxRates: Record<string, number> | null = null;
  try {
    const bootstrap = await loadPublicBootstrap();
    displayCurrency = bootstrap.homeCurrency;
    fxRates = bootstrap.fxRates;
  } catch {
    // No resolvable tenant: currency conversion falls back to native amounts.
  }

  return (
    <html
      lang="en"
      className={appearance.className}
      style={appearance.style}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript tenantModeDefault={theme.modeDefault} />
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
