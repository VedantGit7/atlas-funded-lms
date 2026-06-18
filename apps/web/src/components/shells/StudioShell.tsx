import Link from "next/link";
import type { ReactNode } from "react";

type StudioShellProps = {
  children: ReactNode;
};

const navItems = [{ href: "/studio/courses", label: "Courses" }] as const;

export function StudioShell({ children }: StudioShellProps) {
  return (
    <div className="studio-shell min-h-screen">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/studio/courses" className="font-semibold">
            Studio
          </Link>
          <nav aria-label="Studio navigation" className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/courses">Learner catalog</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
