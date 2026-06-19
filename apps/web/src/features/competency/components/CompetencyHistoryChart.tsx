import type { z } from "zod";
import type { competencySnapshotDtoSchema } from "../../../server/competency/competency-projection.schemas";

type CompetencySnapshot = z.infer<typeof competencySnapshotDtoSchema>;

type CompetencyHistoryChartProps = {
  snapshots: CompetencySnapshot[];
};

export function CompetencyHistoryChart({ snapshots }: CompetencyHistoryChartProps) {
  if (snapshots.length === 0) {
    return (
      <section className="rounded border p-6">
        <h2 className="font-medium">Score history</h2>
        <p className="mt-2 text-sm opacity-80">No score history yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2 className="font-medium">Score history</h2>
        <p className="text-sm opacity-80">Trajectory across competency dimensions over time.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2">Recorded</th>
              <th className="px-2 py-2">Profile</th>
              <th className="px-2 py-2">Dimensions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="border-b align-top">
                <td className="px-2 py-2 whitespace-nowrap">
                  {new Date(snapshot.occurredAt).toLocaleString()}
                </td>
                <td className="px-2 py-2">{snapshot.scoringProfileKey}</td>
                <td className="px-2 py-2">
                  <ul className="space-y-1">
                    {snapshot.scores.map((score) => (
                      <li key={`${snapshot.id}-${score.dimensionId}`}>
                        {score.dimensionKey}: {score.score.toFixed(1)}
                        {score.bandKey ? ` (${score.bandKey})` : ""}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
