const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const INITIAL_EASE = 2.0;
const INITIAL_INTERVAL_DAYS = 1;

export type SrsSnapshot = {
  easeFactor: number;
  intervalDays: number;
};

export type SrsScheduleResult = SrsSnapshot & {
  dueAt: Date;
};

function addDays(days: number): Date {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

export function scheduleSrsUpdate(args: {
  previous: SrsSnapshot | null;
  isCorrect: boolean;
}): SrsScheduleResult {
  if (!args.previous) {
    return {
      easeFactor: INITIAL_EASE,
      intervalDays: INITIAL_INTERVAL_DAYS,
      dueAt: addDays(INITIAL_INTERVAL_DAYS),
    };
  }

  if (args.isCorrect) {
    const easeFactor = Math.min(Number((args.previous.easeFactor + 0.1).toFixed(4)), MAX_EASE);
    const intervalDays = Math.max(1, Math.ceil(args.previous.intervalDays * easeFactor));

    return {
      easeFactor,
      intervalDays,
      dueAt: addDays(intervalDays),
    };
  }

  const easeFactor = Math.max(Number((args.previous.easeFactor - 0.2).toFixed(4)), MIN_EASE);

  return {
    easeFactor,
    intervalDays: INITIAL_INTERVAL_DAYS,
    dueAt: addDays(INITIAL_INTERVAL_DAYS),
  };
}
