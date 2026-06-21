import Link from "next/link";
import type { ReactNode } from "react";

type ModerationShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/moderate/cases", label: "Cases" },
  { href: "/moderate/appeals", label: "Appeals" },
  { href: "/moderate/spaces", label: "Spaces" },
] as const;

export function ModerationShell({ children }: ModerationShellProps) {
  return (
    <div className="moderation-shell min-h-screen">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/moderate/cases" className="font-semibold">
            Moderation
          </Link>
          <nav
            aria-label="Moderation navigation"
            className="flex flex-wrap items-center gap-4 text-sm"
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/community">Community</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
