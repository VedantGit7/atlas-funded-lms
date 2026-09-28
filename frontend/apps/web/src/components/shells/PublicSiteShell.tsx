import type { ReactNode } from "react";
import Link from "next/link";
import { TenantLogo } from "@atlas/design-system/components/tenant-logo";
import { DeferredMarketingCtaRuntime as MarketingCtaRuntime } from "../../features/marketing/DeferredMarketingCtaRuntime";
import { ShellSkipLink } from "./shared/ShellSkipLink";

type PublicSiteShellProps = {
  children: ReactNode;
  publicName: string;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  /** Full-bleed landing pages ship their own nav and footer. */
  variant?: "default" | "landing";
};

export function PublicSiteShell({
  children,
  publicName,
  logoLightUrl = null,
  logoDarkUrl = null,
  variant = "default",
}: PublicSiteShellProps) {
  if (variant === "landing") {
    return (
      <div className="public-site-shell min-h-screen">
        <ShellSkipLink />
        <main id="main-content">{children}</main>
        <MarketingCtaRuntime isAuthenticated={false} />
      </div>
    );
  }

  return (
    <div className="public-site-shell min-h-screen bg-background text-foreground">
      <ShellSkipLink />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/diagnostic" className="text-brand-primary">
            <TenantLogo
              publicName={publicName}
              logoLightUrl={logoLightUrl}
              logoDarkUrl={logoDarkUrl}
            />
          </Link>
          <nav
            aria-label="Public navigation"
            className="flex w-full items-center justify-end gap-3 text-sm sm:w-auto"
          >
            <Link href="/login" className="min-h-10 py-2">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="min-h-10 rounded border border-border px-3 py-2 font-medium"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>
      <MarketingCtaRuntime isAuthenticated={false} />
    </div>
  );
}
