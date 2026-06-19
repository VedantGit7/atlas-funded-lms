import Link from "next/link";
import type { ReactNode } from "react";

type ReviewShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/review", label: "Review & Approvals" },
  { href: "/studio/courses", label: "Studio" },
  { href: "/admin", label: "Admin" },
] as const;

export function ReviewShell({ children }: ReviewShellProps) {
  return (
    <div className="review-shell min-h-screen">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/review" className="font-semibold">
            Review
          </Link>
          <nav aria-label="Review navigation" className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
