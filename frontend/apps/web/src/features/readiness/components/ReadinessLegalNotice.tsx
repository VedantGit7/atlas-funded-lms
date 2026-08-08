import { Info } from "lucide-react";
import type { LegalCopyConfig } from "@atlas/contracts/readiness/readiness.types";

type ReadinessLegalNoticeProps = {
  legalCopy: LegalCopyConfig | null;
};

const DEFAULT_DISCLAIMER =
  "Readiness scores reflect theoretical readiness and simulation performance only. Band classifications may be recalibrated over time and do not guarantee future results.";

export function ReadinessLegalNotice({ legalCopy }: ReadinessLegalNoticeProps) {
  const disclaimer = legalCopy?.disclaimer.trim() || DEFAULT_DISCLAIMER;
  const paragraphs = disclaimer.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0);

  return (
    <footer className="rounded-2xl border border-border bg-muted/40 p-6">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Info className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Assessment policy &amp; disclosures
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </footer>
  );
}
