import type {
  LessonQuiz,
  LessonQuizQuestion,
  LessonQuizSettings,
  PutLessonQuizBody,
} from "@atlas/contracts/lessons/lesson-quiz.schemas";

/**
 * The quiz editor inside a course's quiz lesson (QA review 1 M26, review 2
 * 4.1; S3.4): what it says about the quiz, and what it sends.
 */

export type DraftQuestion = Pick<
  LessonQuizQuestion,
  "itemId" | "itemTypeKey" | "contentJson" | "itemStatus" | "answered"
> & {
  /** As typed; validated on save. */
  points: string;
};

export const DEFAULT_QUIZ_SETTINGS: LessonQuizSettings = {
  attemptsAllowed: 3,
  timeLimitSeconds: null,
  passMarkPercent: 70,
  shuffleItems: false,
  shuffleOptions: false,
  showAnswersPolicy: "after_submit",
  questionsPerAttempt: null,
  negativeMarkPercent: 0,
};

/** Negative marking choices: the share of a question's marks a wrong answer loses. */
export const NEGATIVE_MARK_CHOICES: Array<{ value: number; label: string }> = [
  { value: 0, label: "Off" },
  { value: 25, label: "Lose a quarter of the question's marks" },
  { value: 33.33, label: "Lose a third of the question's marks" },
  { value: 50, label: "Lose half of the question's marks" },
  { value: 100, label: "Lose all of the question's marks" },
];

export const SHOW_ANSWERS_CHOICES: Array<{
  value: LessonQuizSettings["showAnswersPolicy"];
  label: string;
}> = [
  { value: "after_submit", label: "Right after they submit" },
  { value: "after_pass", label: "Once they pass" },
  { value: "after_graded", label: "Once every answer is marked" },
  { value: "never", label: "Never" },
];

export function draftQuestionsFrom(quiz: LessonQuiz["quiz"]): DraftQuestion[] {
  return (quiz?.questions ?? []).map((question) => ({
    itemId: question.itemId,
    itemTypeKey: question.itemTypeKey,
    contentJson: question.contentJson,
    itemStatus: question.itemStatus,
    answered: question.answered,
    points: formatMarks(question.points),
  }));
}

export function formatMarks(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function plural(count: number, one: string, many: string): string {
  return `${formatMarks(count)} ${count === 1 ? one : many}`;
}

/** The marks typed for each question, or null where one isn't a valid number. */
export function parsedMarks(questions: DraftQuestion[]): Array<number | null> {
  return questions.map((question) => {
    const trimmed = question.points.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 && value <= 10000 ? value : null;
  });
}

export function totalMarks(questions: DraftQuestion[]): number {
  return parsedMarks(questions).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** How many questions one attempt asks. */
export function questionsAsked(settings: LessonQuizSettings, questionCount: number): number {
  return settings.questionsPerAttempt != null
    ? Math.min(settings.questionsPerAttempt, questionCount)
    : questionCount;
}

/**
 * What a learner faces, in one line: how many questions, the marks and the
 * pass mark, e.g. "10 questions · 10 marks · pass at 7 marks (70%)".
 */
export function marksSummary(settings: LessonQuizSettings, questions: DraftQuestion[]): string {
  const count = questions.length;
  if (count === 0) return "No questions yet";
  const asked = questionsAsked(settings, count);
  const pass = settings.passMarkPercent;
  if (asked < count) {
    return `Each attempt asks ${String(asked)} of ${plural(count, "question", "questions")}, picked at random · pass at ${formatMarks(pass)}%`;
  }
  const marks = totalMarks(questions);
  // A learner passes with at least this many marks (score % >= pass mark).
  const passMarks = Math.round(marks * pass) / 100;
  return `${plural(count, "question", "questions")} · ${plural(marks, "mark", "marks")} · pass at ${plural(passMarks, "mark", "marks")} (${formatMarks(pass)}%)`;
}

export function negativeMarkingSummary(percent: number): string {
  if (!(percent > 0)) return "Wrong answers lose nothing.";
  const choice = NEGATIVE_MARK_CHOICES.find((entry) => Math.abs(entry.value - percent) < 0.01);
  const share =
    choice && choice.value > 0
      ? choice.label.replace("Lose ", "")
      : `${formatMarks(percent)}% of the question's marks`;
  return `A wrong answer loses ${share}; a question left blank loses nothing.`;
}

export type QuizLiveState = { tone: "live" | "waiting" | "empty"; text: string };

/** Whether learners see the quiz, and when they will. */
export function quizLiveState(args: {
  lessonLive: boolean;
  quizStatus: string | null;
  questionCount: number;
}): QuizLiveState {
  if (args.questionCount === 0) {
    return {
      tone: "empty",
      text: "Add at least one question. Learners see the quiz once it has questions.",
    };
  }
  if (args.lessonLive) {
    return args.quizStatus === "PUBLISHED"
      ? { tone: "live", text: "Live. Learners get your changes as soon as you save." }
      : { tone: "waiting", text: "This lesson is live. Save to put the quiz live with it." };
  }
  return {
    tone: "waiting",
    text: "Goes live with this lesson. There's no separate approval for the quiz.",
  };
}

/** What's wrong with the draft, in words, or null when it can be saved. */
export function quizDraftProblem(
  settings: LessonQuizSettings,
  questions: DraftQuestion[],
): string | null {
  const marks = parsedMarks(questions);
  const bad = marks.findIndex((value) => value == null);
  if (bad >= 0) {
    return `Question ${String(bad + 1)} needs marks: a number from 0 to 10,000.`;
  }
  if (!(settings.passMarkPercent >= 0 && settings.passMarkPercent <= 100)) {
    return "The pass mark is a percentage from 0 to 100.";
  }
  if (!(settings.attemptsAllowed >= 1 && settings.attemptsAllowed <= 100)) {
    return "Attempts must be from 1 to 100.";
  }
  if (
    settings.timeLimitSeconds != null &&
    !(settings.timeLimitSeconds >= 60 && settings.timeLimitSeconds <= 86400)
  ) {
    return "The time limit is from 1 minute to 24 hours, or leave it empty for none.";
  }
  if (settings.questionsPerAttempt != null) {
    if (!(settings.questionsPerAttempt >= 1)) {
      return "Ask at least 1 question per attempt.";
    }
    if (questions.length > 0 && settings.questionsPerAttempt >= questions.length) {
      return `To ask a random selection, ask fewer than all ${String(questions.length)} questions, or choose "Every question".`;
    }
  }
  return null;
}

export function saveBody(
  settings: LessonQuizSettings,
  questions: DraftQuestion[],
): PutLessonQuizBody {
  const marks = parsedMarks(questions);
  return {
    settings,
    questions: questions.map((question, index) => ({
      itemId: question.itemId,
      points: marks[index] ?? 0,
    })),
  };
}

/** A stable fingerprint of the draft, to tell whether anything is unsaved. */
export function draftFingerprint(settings: LessonQuizSettings, questions: DraftQuestion[]): string {
  return JSON.stringify({
    settings,
    questions: questions.map((question) => [question.itemId, question.points.trim()]),
  });
}
