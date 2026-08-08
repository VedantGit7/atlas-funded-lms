import type { z } from "zod";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import type {
  competencyScoreDtoSchema,
  competencySnapshotDtoSchema,
} from "@atlas/contracts/competency/competency-projection.schemas";
import { type ActivityDay, buildWeeklyXp } from "../progress-view";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { CompetencyMatrixChart } from "./CompetencyMatrixChart";
import { CredentialsGallery } from "./CredentialsGallery";
import { MasteryVelocityChart } from "./MasteryVelocityChart";
import { ProgressReveal } from "./ProgressReveal";
import { type LevelProgressView, ProgressStatCards } from "./ProgressStatCards";

type CertificateDto = z.infer<typeof certificateDtoSchema>;
type CompetencyScore = z.infer<typeof competencyScoreDtoSchema>;
type CompetencySnapshot = z.infer<typeof competencySnapshotDtoSchema>;

type ProgressDashboardProps = {
  scores: CompetencyScore[];
  history: CompetencySnapshot[];
  levelProgress: LevelProgressView | null;
  levelKey: string | null;
  xpTotal: number;
  weeklyXp: number;
  streak: { currentCount: number; longestCount: number };
  certificates: CertificateDto[];
  certificatesHasMore: boolean;
  activityDays: ActivityDay[];
  activityRangeEnd: string;
  activityActiveDays: number;
  activityTotalXp: number;
};

export function ProgressDashboard({
  scores,
  history,
  levelProgress,
  levelKey,
  xpTotal,
  weeklyXp,
  streak,
  certificates,
  certificatesHasMore,
  activityDays,
  activityRangeEnd,
  activityActiveDays,
  activityTotalXp,
}: ProgressDashboardProps) {
  const weeks = buildWeeklyXp(activityDays, activityRangeEnd, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <p className="sr-only" aria-live="polite">
        Progress dashboard loaded.
      </p>

      <ProgressReveal>
        <ProgressStatCards
          levelProgress={levelProgress}
          levelKey={levelKey}
          xpTotal={xpTotal}
          weeklyXp={weeklyXp}
          streak={streak}
          certificatesCount={certificates.length}
          certificatesHasMore={certificatesHasMore}
        />
      </ProgressReveal>

      <ProgressReveal delay={0.05}>
        <ActivityHeatmap
          days={activityDays}
          rangeEnd={activityRangeEnd}
          activeDays={activityActiveDays}
          totalXp={activityTotalXp}
        />
      </ProgressReveal>

      <ProgressReveal delay={0.05}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CompetencyMatrixChart scores={scores} snapshots={history} />
          <MasteryVelocityChart weeks={weeks} currentLevel={levelProgress?.levelNumber ?? null} />
        </div>
      </ProgressReveal>

      <ProgressReveal delay={0.05}>
        <CredentialsGallery certificates={certificates} />
      </ProgressReveal>
    </div>
  );
}
