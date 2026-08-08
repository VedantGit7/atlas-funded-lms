import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DiagnosticNextAction } from "@atlas/contracts-modules/diagnostics/diagnostic.types";

type DiagnosticNextActionCardProps = {
  nextAction: DiagnosticNextAction;
};

export function DiagnosticNextActionCard({ nextAction }: DiagnosticNextActionCardProps) {
  return (
    <section
      aria-labelledby="diagnostic-next-action"
      className="relative overflow-hidden rounded-2xl border border-primary bg-primary p-6 text-primary-foreground md:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_2px_2px,var(--primary-foreground)_1px,transparent_0)] [background-size:24px_24px]"
      />
      <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">
            Your personal path
          </p>
          <h2 id="diagnostic-next-action" className="mt-2 text-2xl font-semibold tracking-tight">
            {nextAction.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
            {nextAction.description}
          </p>
        </div>
        <Link
          href="/roadmap"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-6 py-3.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90 md:w-auto"
        >
          View your roadmap
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
