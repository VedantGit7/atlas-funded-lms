/**
 * Pure helpers shared by the server page (data assembly) and the client
 * dashboard. Colors here are data-visualization accents (readiness / mastery
 * bands), centralised so the ramp stays consistent, not scattered hex literals.
 */

export type LevelInfo = {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progressPercent: number;
};

/** Map an overall readiness/mastery score (0-100) to a band accent color. */
export function scoreColor(score: number): string {
  if (score >= 85) return "#22c55e"; // advanced / mastered
  if (score >= 65) return "#3b82f6"; // proficient
  if (score >= 40) return "#6366f1"; // developing
  return "#f59e0b"; // emerging
}

export function scoreBandLabel(score: number): string {
  if (score >= 85) return "Advanced";
  if (score >= 65) return "Proficient";
  if (score >= 40) return "Developing";
  return "Emerging";
}

/**
 * Resolve a numeric level + progress-to-next from XP and the tenant's real
 * level thresholds. Thresholds are `{ levelKey, minXp }`, sorted ascending.
 */
export function computeLevel(
  xpTotal: number,
  thresholds: ReadonlyArray<{ levelKey: string; minXp: number }>,
): LevelInfo {
  const sorted = [...thresholds].sort((a, b) => a.minXp - b.minXp);
  const first = sorted[0];
  if (!first) {
    return { level: 1, xpIntoLevel: xpTotal, xpForNextLevel: null, progressPercent: 0 };
  }

  let index = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const threshold = sorted[i];
    if (threshold && xpTotal >= threshold.minXp) index = i;
  }

  const current = sorted[index] ?? first;
  const next = sorted[index + 1] ?? null;
  const level = index + 1;

  if (!next) {
    return {
      level,
      xpIntoLevel: xpTotal - current.minXp,
      xpForNextLevel: null,
      progressPercent: 100,
    };
  }

  const span = next.minXp - current.minXp;
  const into = xpTotal - current.minXp;
  const progressPercent = span > 0 ? Math.round((into / span) * 100) : 0;
  return { level, xpIntoLevel: into, xpForNextLevel: next.minXp - current.minXp, progressPercent };
}
