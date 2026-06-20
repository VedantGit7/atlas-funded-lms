import Link from "next/link";
import type { ReactNode } from "react";

type LearnerShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/courses", label: "Courses" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/swipe", label: "Practice" },
  { href: "/diagnostic/me", label: "Diagnostic" },
  { href: "/readiness", label: "Readiness" },
  { href: "/progress", label: "Progress" },
  { href: "/achievements", label: "Achievements" },
  { href: "/leaderboards", label: "Leaderboards" },
] as const;

export function LearnerShell({ children }: LearnerShellProps) {
  return (
    <div className="learner-shell min-h-screen">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/courses" className="font-semibold">
            Learn
          </Link>
          <nav aria-label="Learner navigation" className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
