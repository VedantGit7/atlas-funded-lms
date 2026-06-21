import type { z } from "zod";
import type { certificateDtoSchema } from "../../../server/certificates/certificate.dto";
import type { competencySnapshotDtoSchema } from "../../../server/competency/competency-projection.schemas";
import type { competencyScoreDtoSchema } from "../../../server/competency/competency-projection.schemas";
import { CompetencyHistoryChart } from "../../competency/components/CompetencyHistoryChart";
import { CompetencyScoreCards } from "../../competency/components/CompetencyScoreCards";
import { GamificationSummaryCard } from "../../gamification/components/GamificationSummaryCard";
import { CertificateCard } from "../../certificates/components/CertificateCard";

type CertificateDto = z.infer<typeof certificateDtoSchema>;
type CompetencySnapshot = z.infer<typeof competencySnapshotDtoSchema>;
type CompetencyScore = z.infer<typeof competencyScoreDtoSchema>;

type ProgressDashboardProps = {
  scores: CompetencyScore[];
  history: CompetencySnapshot[];
  gamification: { levelKey: string; xpTotal: number } | null;
  streakCount: number;
  certificates: CertificateDto[];
};

export function ProgressDashboard({
  scores,
  history,
  gamification,
  streakCount,
  certificates,
}: ProgressDashboardProps) {
  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">
        Progress dashboard loaded.
      </p>

      {gamification ? (
        <GamificationSummaryCard
          levelKey={gamification.levelKey}
          xpTotal={gamification.xpTotal}
          streakCount={streakCount}
        />
      ) : null}

      <CompetencyScoreCards scores={scores} />
      <CompetencyHistoryChart snapshots={history} />

      <section aria-labelledby="progress-certificates-heading" className="space-y-3">
        <h2 id="progress-certificates-heading" className="text-lg font-semibold">
          Certificates earned
        </h2>
        {certificates.length === 0 ? (
          <p>You have not earned any certificates yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certificates.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
