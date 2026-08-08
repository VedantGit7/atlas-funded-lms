import { describe, expect, it } from "vitest";
import {
  evaluateCourseCertificateEligibility,
  meetsCompletionCriteria,
  meetsTestPassingMarks,
  parseCourseCertificateSettings,
  selectAttemptScore,
} from "../../../src/server/certificates/course-certificate-eligibility";

describe("parseCourseCertificateSettings", () => {
  it("reads studioFeatures certificate configuration", () => {
    const settings = parseCourseCertificateSettings({
      studioFeatures: {
        certificate: true,
        certificateTemplateId: "11111111-1111-1111-1111-111111111111",
        certificateConfiguration: {
          tests: [
            {
              lessonId: "22222222-2222-2222-2222-222222222222",
              title: "Module quiz",
              passingMarks: 70,
            },
          ],
          completionCriteriaPercent: 80,
          attemptMode: "latest_attempt",
          validityDays: 365,
        },
      },
    });

    expect(settings.enabled).toBe(true);
    expect(settings.templateId).toBe("11111111-1111-1111-1111-111111111111");
    expect(settings.completionCriteriaPercent).toBe(80);
    expect(settings.attemptMode).toBe("latest_attempt");
    expect(settings.validityDays).toBe(365);
    expect(settings.certificateTests).toHaveLength(1);
  });
});

describe("selectAttemptScore", () => {
  const attempts = [
    {
      assessmentId: "a",
      scorePercent: 40,
      submittedAt: "2026-01-01T00:00:00.000Z",
      gradedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      assessmentId: "a",
      scorePercent: 90,
      submittedAt: "2026-01-02T00:00:00.000Z",
      gradedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  it("picks first attempt", () => {
    expect(selectAttemptScore(attempts, "first_attempt")?.scorePercent).toBe(40);
  });

  it("picks latest attempt", () => {
    expect(selectAttemptScore(attempts, "latest_attempt")?.scorePercent).toBe(90);
  });
});

describe("evaluateCourseCertificateEligibility", () => {
  it("requires completion and passing tests", () => {
    const lessonId = "22222222-2222-2222-2222-222222222222";
    const assessmentId = "33333333-3333-3333-3333-333333333333";

    const result = evaluateCourseCertificateEligibility({
      settings: {
        enabled: true,
        templateId: "11111111-1111-1111-1111-111111111111",
        certificateTests: [{ lessonId, title: "Quiz", passingMarks: 70 }],
        completionCriteriaPercent: 80,
        attemptMode: "latest_attempt",
      },
      courseStatus: "PUBLISHED",
      completionPercent: 85,
      assessmentIdByLessonId: new Map([[lessonId, assessmentId]]),
      attemptsByAssessmentId: new Map([
        [
          assessmentId,
          [
            {
              assessmentId,
              scorePercent: 88,
              submittedAt: "2026-01-02T00:00:00.000Z",
              gradedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        ],
      ]),
      hasTemplate: true,
    });

    expect(result).toEqual({ eligible: true });
  });

  it("rejects when completion is too low", () => {
    expect(meetsCompletionCriteria(50, 80)).toBe(false);
    expect(meetsTestPassingMarks(69, 70)).toBe(false);
  });
});
