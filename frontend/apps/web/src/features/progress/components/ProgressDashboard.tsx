import type { z } from "zod";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import type {
  competencyScoreDtoSchema,
  competencySnapshotDtoSchema,
} from "@atlas/contracts/competency/competency-projection.schemas";
import type { MyCoursesResponse } from "@atlas/contracts/enrollments/my-courses.schemas";
import { type ActivityDay, buildWeeklyXp } from "../progress-view";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { CompetencyMatrixChart } from "./CompetencyMatrixChart";
import { CourseProgressSection } from "./CourseProgressSection";
import { CredentialsGallery } from "./CredentialsGallery";
import { MasteryVelocityChart } from "./MasteryVelocityChart";
import { ProgressReveal } from "./ProgressReveal";
import { type LevelProgressView, ProgressStatCards } from "./ProgressStatCards";

type CertificateDto = z.infer<typeof certificateDtoSchema>;
type CompetencyScore = z.infer<typeof competencyScoreDtoSchema>;
type CompetencySnapshot = z.infer<typeof competencySnapshotDtoSchema>;

export type ProgressGamification = {
  levelProgress: LevelProgressView | null;
  levelKey: string | null;
  xpTotal: number;
  weeklyXp: number;
  streak: { currentCount: number; longestCount: number };
  activity: { days: ActivityDay[]; rangeEnd: string; activeDays: number; totalXp: number } | null;
};

type ProgressDashboardProps = {
  courses: MyCoursesResponse["data"] | null;
  /** Null when gamification is off for the academy: no XP, level or streak cards. */
  gamification: ProgressGamification | null;
  /** Null when the skills read is unavailable; an empty list hides the chart. */
  competency: { scores: CompetencyScore[]; history: CompetencySnapshot[] } | null;
  /** Null when certificates are off for the academy. */
  certificates: { items: CertificateDto[]; hasMore: boolean } | null;
};

/**
 * The Progress page (QA remediation S3.3): course progress first, from saved
 * lesson progress; XP, streak and certificates only where the academy has
 * them on, so a learner never sees a row of zeros for a feature that's off.
 */
export function ProgressDashboard({
  courses,
  gamification,
  competency,
  certificates,
}: ProgressDashboardProps) {
  const weeks = gamification?.activity
    ? buildWeeklyXp(gamification.activity.days, gamification.activity.rangeEnd, 8)
    : null;
  const showCompetency = (competency?.scores.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ProgressReveal>
        <CourseProgressSection courses={courses} />
      </ProgressReveal>

      {gamification ? (
        <ProgressReveal delay={0.05}>
          <ProgressStatCards
            levelProgress={gamification.levelProgress}
            levelKey={gamification.levelKey}
            xpTotal={gamification.xpTotal}
            weeklyXp={gamification.weeklyXp}
            streak={gamification.streak}
            certificates={
              certificates
                ? { count: certificates.items.length, hasMore: certificates.hasMore }
                : null
            }
          />
        </ProgressReveal>
      ) : null}

      {gamification?.activity ? (
        <ProgressReveal delay={0.05}>
          <ActivityHeatmap
            days={gamification.activity.days}
            rangeEnd={gamification.activity.rangeEnd}
            activeDays={gamification.activity.activeDays}
            totalXp={gamification.activity.totalXp}
          />
        </ProgressReveal>
      ) : null}

      {showCompetency || weeks ? (
        <ProgressReveal delay={0.05}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {showCompetency && competency ? (
              <CompetencyMatrixChart scores={competency.scores} snapshots={competency.history} />
            ) : null}
            {weeks ? (
              <MasteryVelocityChart
                weeks={weeks}
                currentLevel={gamification?.levelProgress?.levelNumber ?? null}
              />
            ) : null}
          </div>
        </ProgressReveal>
      ) : null}

      {certificates && certificates.items.length > 0 ? (
        <ProgressReveal delay={0.05}>
          <CredentialsGallery certificates={certificates.items} />
        </ProgressReveal>
      ) : null}
    </div>
  );
}
