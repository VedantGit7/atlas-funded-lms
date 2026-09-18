"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  cancelEnrollment,
  fetchCourseLearnerRoster,
  fetchLearnerAttemptSummaries,
  fetchMemberCompetencySnapshot,
  fetchPublishedCertificateTemplates,
  formatStudioLearnerApiError,
  issueCourseCertificate,
  type CourseLearnerRow,
  type LearnerAttemptSummary,
} from "./api";

type CourseLearnerRosterProps = {
  courseId: string;
  courseTitle: string;
};

type CompetencySnapshot = {
  dimensionKey: string;
  dimensionName: string;
  score: number;
}[];

type CertificateTemplateOption = {
  id: string;
  name: string;
};

export function CourseLearnerRoster({ courseId, courseTitle }: CourseLearnerRosterProps) {
  const [rows, setRows] = useState<CourseLearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<CourseLearnerRow | null>(null);
  const [competency, setCompetency] = useState<CompetencySnapshot | null>(null);
  const [competencyLoading, setCompetencyLoading] = useState(false);
  const [competencyError, setCompetencyError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<LearnerAttemptSummary[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CertificateTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [certMessage, setCertMessage] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [roster, templateList] = await Promise.all([
        fetchCourseLearnerRoster(courseId),
        fetchPublishedCertificateTemplates(),
      ]);
      setRows(roster);
      setTemplates(templateList);
      setSelectedTemplateId((current) => current || templateList[0]?.id || "");
    } catch (error) {
      setErrorMessage(formatStudioLearnerApiError(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const cancelEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId: string) => cancelEnrollment(enrollmentId),
    onMutate: (enrollmentId) => {
      const previous = rows;
      setRows((current) => current.filter((row) => row.enrollmentId !== enrollmentId));
      if (selectedRow?.enrollmentId === enrollmentId) {
        setSelectedRow(null);
      }
      return { previous };
    },
    onError: (error, _enrollmentId, context) => {
      if (context?.previous) {
        setRows(context.previous);
      }
      setErrorMessage(formatStudioLearnerApiError(error));
    },
  });

  const issueCertificateMutation = useMutation({
    mutationFn: ({ membershipId, templateId }: { membershipId: string; templateId: string }) =>
      issueCourseCertificate({
        courseId,
        recipientMembershipId: membershipId,
        templateId,
      }),
    onSuccess: (response) => {
      setCertMessage(`Certificate issued (${response.data.credentialId}).`);
    },
    onError: (error) => {
      setCertMessage(formatStudioLearnerApiError(error));
    },
  });

  async function handleSelectMember(row: CourseLearnerRow) {
    setSelectedRow(row);
    setCompetencyLoading(true);
    setCompetencyError(null);
    setCompetency(null);
    setAttemptsLoading(true);
    setAttemptsError(null);
    setAttempts([]);
    setCertMessage(null);

    try {
      const [competencyResponse, attemptSummaries] = await Promise.all([
        fetchMemberCompetencySnapshot(row.membershipId),
        fetchLearnerAttemptSummaries(row.membershipId),
      ]);
      setCompetency(
        competencyResponse.data.scores.map((score) => ({
          dimensionKey: score.dimensionKey,
          dimensionName: score.dimensionName,
          score: score.score,
        })),
      );
      setAttempts(attemptSummaries);
    } catch (error) {
      const message = formatStudioLearnerApiError(error);
      setCompetencyError(message);
      setAttemptsError(message);
    } finally {
      setCompetencyLoading(false);
      setAttemptsLoading(false);
    }
  }

  if (loading) {
    return <p>Loading learner roster…</p>;
  }

  if (errorMessage) {
    return (
      <p role="alert" className="rounded border border-destructive/40 p-3">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <p>No enrolled learners yet for {courseTitle}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Learner roster for {courseTitle}</caption>
            <thead>
              <tr>
                <th className="text-left">Learner</th>
                <th className="text-left">Enrolled</th>
                <th className="text-left">Progress</th>
                <th className="text-left">Lessons</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.enrollmentId} className="border-t">
                  <td>{row.displayName}</td>
                  <td>{new Date(row.enrolledAt).toLocaleDateString()}</td>
                  <td>{row.progressPct}%</td>
                  <td>
                    {row.completedLessons}/{row.totalLessons}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          void handleSelectMember(row);
                        }}
                      >
                        Drill in
                      </button>
                      <button
                        type="button"
                        className="underline"
                        disabled={cancelEnrollmentMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Cancel enrollment for ${row.displayName}?`)) {
                            cancelEnrollmentMutation.mutate(row.enrollmentId);
                          }
                        }}
                      >
                        Cancel enrollment
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow ? (
        <section
          aria-labelledby="learner-drill-in-heading"
          className="space-y-6 rounded border p-4"
        >
          <h2 id="learner-drill-in-heading" className="font-semibold">
            {selectedRow.displayName}
          </h2>

          <div>
            <h3 className="font-medium">Competency snapshot</h3>
            {competencyLoading ? <p className="mt-2 text-sm">Loading competency…</p> : null}
            {competencyError ? (
              <p role="alert" className="mt-2 text-sm">
                {competencyError}
              </p>
            ) : null}
            {competency && competency.length > 0 ? (
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {competency.map((entry) => (
                    <tr key={entry.dimensionKey} className="border-t">
                      <td>{entry.dimensionName}</td>
                      <td>{entry.score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          <div>
            <h3 className="font-medium">Assessment attempts</h3>
            {attemptsLoading ? <p className="mt-2 text-sm">Loading attempts…</p> : null}
            {attemptsError ? (
              <p role="alert" className="mt-2 text-sm">
                {attemptsError}
              </p>
            ) : null}
            {attempts.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm">
                {attempts.map((attempt) => (
                  <li key={attempt.attemptId} className="flex flex-wrap items-center gap-2">
                    <span>
                      {attempt.assessmentTitle} · {attempt.status}
                      {attempt.scorePercent != null ? ` · ${attempt.scorePercent}%` : ""}
                    </span>
                    <Link href={`/attempts/${attempt.attemptId}/result`} className="underline">
                      View attempt
                    </Link>
                    {attempt.gradingTaskId ? (
                      <Link href={`/studio/grading/${attempt.gradingTaskId}`} className="underline">
                        Open grading task
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : !attemptsLoading && !attemptsError ? (
              <p className="mt-2 text-sm opacity-80">No assessment attempts for this learner.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Issue certificate</h3>
            {templates.length === 0 ? (
              <p className="text-sm opacity-80">No published certificate templates available.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1 text-sm">
                  <span>Template</span>
                  <select
                    className="block rounded border px-2 py-1"
                    value={selectedTemplateId}
                    onChange={(event) => {
                      setSelectedTemplateId(event.target.value);
                    }}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={issueCertificateMutation.isPending || !selectedTemplateId}
                  onClick={() => {
                    issueCertificateMutation.mutate({
                      membershipId: selectedRow.membershipId,
                      templateId: selectedTemplateId,
                    });
                  }}
                >
                  {issueCertificateMutation.isPending ? "Issuing…" : "Issue certificate"}
                </button>
              </div>
            )}
            {certMessage ? <p className="text-sm">{certMessage}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
