import Link from "next/link";
import type { ReactNode } from "react";

type PublicSiteShellProps = {
  children: ReactNode;
  title?: string;
};

export function PublicSiteShell({ children, title = "Atlas Academy" }: PublicSiteShellProps) {
  return (
    <div className="public-site-shell min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/diagnostic" className="text-lg font-semibold">
            {title}
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-3 text-sm">
            <Link href="/login">Sign in</Link>
            <Link href="/signup" className="rounded border px-3 py-1">
              Create account
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
