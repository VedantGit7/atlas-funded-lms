export type PsychometricQualityFlag = "bad" | "fair" | "good";

export type DistractorRate = {
  optionId: string;
  rate: number;
};

export type ItemPsychometrics = {
  difficulty: number | null;
  discrimination: number | null;
  distractorRates: DistractorRate[] | null;
  sampleSizeWarning: boolean;
  qualityFlag: PsychometricQualityFlag;
};

const MIN_DISCRIMINATION_SAMPLE = 10;
const QUALITY_MIN_ATTEMPTS = 50;
const BAD_MAX_ATTEMPTS = 20;

export function computeDifficulty(attemptsCount: number, correctCount: number): number | null {
  if (attemptsCount <= 0) {
    return null;
  }
  return correctCount / attemptsCount;
}

export function clampDiscrimination(value: number): number {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

export function computeDiscriminationStub(
  attemptsCount: number,
  correctCount: number,
): number | null {
  const difficulty = computeDifficulty(attemptsCount, correctCount);
  if (difficulty == null) {
    return null;
  }
  return clampDiscrimination((difficulty - 0.5) * 2);
}

export function computeDiscriminationFromLatency(args: {
  meanCorrectLatencyMs: number | null;
  meanIncorrectLatencyMs: number | null;
}): number | null {
  const { meanCorrectLatencyMs, meanIncorrectLatencyMs } = args;
  if (meanCorrectLatencyMs == null || meanIncorrectLatencyMs == null) {
    return null;
  }

  const spread = meanIncorrectLatencyMs - meanCorrectLatencyMs;
  const scale = Math.max(meanCorrectLatencyMs, meanIncorrectLatencyMs, 1);
  return clampDiscrimination(spread / scale);
}

export function computeSampleSizeWarning(attemptsCount: number): boolean {
  return attemptsCount < QUALITY_MIN_ATTEMPTS;
}

export function computePsychometricQualityFlag(args: {
  attemptsCount: number;
  difficulty: number | null;
  discrimination: number | null;
}): PsychometricQualityFlag {
  const { attemptsCount, difficulty, discrimination } = args;

  if (attemptsCount < BAD_MAX_ATTEMPTS) {
    return "bad";
  }

  if (difficulty != null && (difficulty < 0.2 || difficulty > 0.9)) {
    return "bad";
  }

  if (
    attemptsCount >= QUALITY_MIN_ATTEMPTS &&
    difficulty != null &&
    difficulty >= 0.3 &&
    difficulty <= 0.7 &&
    discrimination != null &&
    discrimination > 0.2
  ) {
    return "good";
  }

  return "fair";
}

export function buildDistractorRates(
  distractorCounts: Record<string, number>,
  attemptsCount: number,
): DistractorRate[] | null {
  const entries = Object.entries(distractorCounts).filter(([, count]) => count > 0);
  if (entries.length === 0 || attemptsCount <= 0) {
    return null;
  }

  return entries
    .map(([optionId, count]) => ({
      optionId,
      rate: count / attemptsCount,
    }))
    .sort((left, right) => right.rate - left.rate);
}

export function mergeDistractorCount(
  existing: Record<string, number> | undefined,
  optionId: string | null | undefined,
): Record<string, number> {
  if (!optionId) {
    return existing ?? {};
  }

  const next = { ...(existing ?? {}) };
  next[optionId] = (next[optionId] ?? 0) + 1;
  return next;
}

export function buildItemPsychometrics(args: {
  attemptsCount: number;
  correctCount: number;
  discrimination?: number | null;
  distractorCounts?: Record<string, number>;
}): ItemPsychometrics {
  const difficulty = computeDifficulty(args.attemptsCount, args.correctCount);
  const discrimination =
    args.discrimination ??
    (args.attemptsCount >= MIN_DISCRIMINATION_SAMPLE
      ? computeDiscriminationStub(args.attemptsCount, args.correctCount)
      : computeDiscriminationStub(args.attemptsCount, args.correctCount));

  const distractorRates = buildDistractorRates(args.distractorCounts ?? {}, args.attemptsCount);

  return {
    difficulty,
    discrimination,
    distractorRates,
    sampleSizeWarning: computeSampleSizeWarning(args.attemptsCount),
    qualityFlag: computePsychometricQualityFlag({
      attemptsCount: args.attemptsCount,
      difficulty,
      discrimination,
    }),
  };
}

export function psychometricsToMetricsJson(
  psychometrics: ItemPsychometrics,
  distractorCounts?: Record<string, number>,
): Record<string, unknown> {
  return {
    difficulty: psychometrics.difficulty,
    discrimination: psychometrics.discrimination,
    distractorRates: psychometrics.distractorRates,
    distractorCounts: distractorCounts ?? {},
    sampleSizeWarning: psychometrics.sampleSizeWarning,
    qualityFlag: psychometrics.qualityFlag,
  };
}
