import type { TenantTx } from "@atlas/db";
import {
  assessmentsRepository,
  extractAssessmentConfig,
} from "../assessments/assessments.repository";
import { reviewItem } from "../attempts/attempt-review";
import {
  decodeExplanationJson,
  itemRegistryRepository,
} from "../item-registry/item-registry.repository";
import { workflowItemNotFound } from "./workflow.errors";
import type { ReviewQuiz, WorkflowContentResponse } from "./workflow-content.schemas";
import { findWorkflowTransitionById } from "./workflows.repository";

/**
 * The questions a reviewer approves (QA review 2 4.1; S3.4): for a course, the
 * quiz of each of its quiz lessons, in course order; for a quiz, the quiz.
 */

function optionLabel(optionJson: unknown, position: number): string {
  const label =
    optionJson && typeof optionJson === "object" && !Array.isArray(optionJson)
      ? (optionJson as Record<string, unknown>)["label"]
      : null;
  return typeof label === "string" && label.trim() ? label : `Option ${String(position)}`;
}

async function describeReviewQuiz(
  tx: TenantTx,
  assessmentId: string,
  place: { lessonTitle: string | null; sectionTitle: string | null },
): Promise<ReviewQuiz | null> {
  const assessment = await assessmentsRepository.findById(tx, assessmentId);
  if (!assessment) return null;
  const config = extractAssessmentConfig(assessment.config_json);
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  const loaded = await itemRegistryRepository.loadItemsWithOptions(
    tx,
    rows.map((row) => row.item_id),
  );

  const questions: ReviewQuiz["questions"] = [];
  for (const row of rows) {
    const found = loaded.get(row.item_id);
    if (!found) continue;
    const decoded = decodeExplanationJson(found.item.explanation_json);
    const options = found.options.map((option) => ({
      id: option.id,
      label: optionLabel(option.option_json, option.position),
      isCorrect: option.is_correct ?? null,
      position: option.position,
    }));
    const review = reviewItem({
      itemTypeKey: found.item.item_type_key,
      answerKeyJson: decoded.answerKeyJson,
      options,
      answerJson: null,
    });
    questions.push({
      position: row.position,
      itemTypeKey: found.item.item_type_key,
      contentJson: (found.item.stem_json ?? {}) as Record<string, unknown>,
      points: Number(row.points),
      choices: options.map((option) => ({
        label: option.label,
        correct: review.correctAnswer.includes(option.label) || option.isCorrect === true,
      })),
      correctAnswer: review.correctAnswer,
      correctAnswerLabel: review.correctAnswerLabel,
      explanation: review.explanation,
    });
  }

  return {
    assessmentId,
    title: assessment.title,
    lessonTitle: place.lessonTitle,
    sectionTitle: place.sectionTitle,
    passMarkPercent: config.passMarkPercent,
    attemptsAllowed: config.attemptsAllowed,
    timeLimitSeconds: config.timeLimitSeconds ?? null,
    questionsPerAttempt: config.questionsPerAttempt ?? null,
    negativeMarkPercent: config.negativeMarkPercent,
    totalMarks: questions.reduce((sum, question) => sum + question.points, 0),
    questions,
  };
}

export async function getWorkflowContent(
  tx: TenantTx,
  transitionId: string,
): Promise<WorkflowContentResponse> {
  const transition = await findWorkflowTransitionById({ tx, transitionId });
  // The transaction is scoped to the academy, so another academy's is never found.
  if (!transition) throw workflowItemNotFound();

  const quizzes: ReviewQuiz[] = [];
  if (transition.targetType === "course") {
    // Quiz lessons that learners could get: not hidden, not deleted.
    const lessons = await tx.$queryRaw<
      Array<{ assessment_id: string; lesson_title: string; section_title: string }>
    >`
      select
        l.content_json->>'assessmentId' as assessment_id,
        l.title as lesson_title,
        m.title as section_title
      from lessons l
      inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
      inner join assessments a
        on a.id::text = l.content_json->>'assessmentId'
        and a.tenant_id = l.tenant_id
        and a.deleted_at is null
      where m.course_id = ${transition.targetId}::uuid
        and l.deleted_at is null
        and m.deleted_at is null
        and l.status <> 'ARCHIVED'::"PublishStatus"
        and m.status <> 'ARCHIVED'::"PublishStatus"
      order by m.position asc, l.position asc
    `;
    for (const lesson of lessons) {
      const quiz = await describeReviewQuiz(tx, lesson.assessment_id, {
        lessonTitle: lesson.lesson_title,
        sectionTitle: lesson.section_title,
      });
      if (quiz) quizzes.push(quiz);
    }
  } else if (transition.targetType === "assessment") {
    const quiz = await describeReviewQuiz(tx, transition.targetId, {
      lessonTitle: null,
      sectionTitle: null,
    });
    if (quiz) quizzes.push(quiz);
  }

  return {
    data: {
      targetType: transition.targetType,
      targetId: transition.targetId,
      quizzes,
    },
  };
}
