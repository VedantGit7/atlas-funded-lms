"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCourseLearnerRoster,
  fetchMemberCompetencySnapshot,
  formatStudioLearnerApiError,
  type CourseLearnerRow,
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

export function CourseLearnerRoster({ courseId, courseTitle }: CourseLearnerRosterProps) {
  const [rows, setRows] = useState<CourseLearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [competency, setCompetency] = useState<CompetencySnapshot | null>(null);
  const [competencyLoading, setCompetencyLoading] = useState(false);
  const [competencyError, setCompetencyError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const roster = await fetchCourseLearnerRoster(courseId);
      setRows(roster);
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

  async function handleSelectMember(membershipId: string) {
    setSelectedMemberId(membershipId);
    setCompetencyLoading(true);
    setCompetencyError(null);
    setCompetency(null);

    try {
      const response = await fetchMemberCompetencySnapshot(membershipId);
      setCompetency(
        response.data.scores.map((score) => ({
          dimensionKey: score.dimensionKey,
          dimensionName: score.dimensionName,
          score: score.score,
        })),
      );
    } catch (error) {
      setCompetencyError(formatStudioLearnerApiError(error));
    } finally {
      setCompetencyLoading(false);
    }
  }

  if (loading) {
    return <p>Loading learner roster…</p>;
  }

  if (errorMessage) {
    return (
      <p role="alert" className="rounded border border-red-300 p-3">
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
                <th className="text-left">Competency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.membershipId} className="border-t">
                  <td>{row.displayName}</td>
                  <td>{new Date(row.enrolledAt).toLocaleDateString()}</td>
                  <td>{row.progressPct}%</td>
                  <td>
                    {row.completedLessons}/{row.totalLessons}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        void handleSelectMember(row.membershipId);
                      }}
                    >
                      View snapshot
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedMemberId ? (
        <section aria-labelledby="competency-snapshot-heading" className="rounded border p-4">
          <h2 id="competency-snapshot-heading" className="font-semibold">
            Competency snapshot
          </h2>
          {competencyLoading ? <p className="mt-2 text-sm">Loading competency…</p> : null}
          {competencyError ? (
            <p role="alert" className="mt-2 text-sm">
              {competencyError}
            </p>
          ) : null}
          {competency && competency.length > 0 ? (
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Per-dimension competency scores</caption>
              <thead>
                <tr>
                  <th className="text-left">Dimension</th>
                  <th className="text-left">Score</th>
                </tr>
              </thead>
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
          {!competencyLoading && !competencyError && competency?.length === 0 ? (
            <p className="mt-2 text-sm opacity-80">No competency scores recorded yet.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
