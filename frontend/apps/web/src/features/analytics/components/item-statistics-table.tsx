import { Info } from "lucide-react";
import { getMetricDescription } from "../metric-glossary";

type PsychometricQualityFlag = "bad" | "fair" | "good";

type ItemStatisticRow = {
  itemReference: { itemId: string; label: string };
  attemptsCount: number;
  correctCount: number;
  accuracy: number | null;
  averageLatencyMs: number | null;
  difficulty?: number | null;
  discrimination?: number | null;
  distractorRates?: Array<{ optionId: string; rate: number }> | null;
  sampleSizeWarning?: boolean;
  qualityFlag?: PsychometricQualityFlag;
};

type ItemStatisticsTableProps = {
  items: ItemStatisticRow[];
  caption: string;
  headClassName?: string;
  rowClassName?: string;
};

function formatRate(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${String(Math.round(value * 1000) / 10)}%`;
}

function formatDiscrimination(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(Math.round(value * 100) / 100);
}

function formatDistractorRates(
  rates: Array<{ optionId: string; rate: number }> | null | undefined,
): string {
  if (!rates || rates.length === 0) return "—";
  return rates
    .map((entry) => `${entry.optionId.slice(0, 6)} ${String(Math.round(entry.rate * 1000) / 10)}%`)
    .join(" · ");
}

function qualityBadgeClassName(flag: PsychometricQualityFlag | undefined): string {
  if (flag === "good") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (flag === "bad") {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";
}

function GlossaryHeader({ label, glossaryKey }: { label: string; glossaryKey: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        className="inline-flex text-[var(--admin-on-surface-variant)]"
        title={getMetricDescription(glossaryKey, label)}
        aria-label={getMetricDescription(glossaryKey, label)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </span>
  );
}

export function ItemStatisticsTable({
  items,
  caption,
  headClassName = "",
  rowClassName = "border-b",
}: ItemStatisticsTableProps) {
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--admin-on-surface-variant)]">No item performance data is available for this assessment yet.</p>;
  }

  const showDistractors = items.some((item) => item.distractorRates && item.distractorRates.length > 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className={`border-b border-[var(--admin-border)] ${headClassName}`}>
            <th scope="col" className="px-3 py-2">
              Item
            </th>
            <th scope="col" className="px-3 py-2">
              Attempts
            </th>
            <th scope="col" className="px-3 py-2">
              Correct
            </th>
            <th scope="col" className="px-3 py-2">
              Accuracy
            </th>
            <th scope="col" className="px-3 py-2">
              <GlossaryHeader label="Difficulty" glossaryKey="difficulty" />
            </th>
            <th scope="col" className="px-3 py-2">
              <GlossaryHeader label="Discrimination" glossaryKey="discrimination" />
            </th>
            <th scope="col" className="px-3 py-2">
              <GlossaryHeader label="Quality" glossaryKey="quality_flag" />
            </th>
            {showDistractors ? (
              <th scope="col" className="px-3 py-2">
                Distractors
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2">
              Avg latency (ms)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemReference.itemId} className={rowClassName}>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span>{item.itemReference.label}</span>
                  {item.sampleSizeWarning ? (
                    <span className="text-[11px] text-[var(--admin-warning)]">Low sample (&lt;50)</span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2">{item.attemptsCount}</td>
              <td className="px-3 py-2">{item.correctCount}</td>
              <td className="px-3 py-2">{formatRate(item.accuracy)}</td>
              <td className="px-3 py-2">{formatRate(item.difficulty ?? item.accuracy)}</td>
              <td className="px-3 py-2">{formatDiscrimination(item.discrimination)}</td>
              <td className="px-3 py-2">
                {item.qualityFlag ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${qualityBadgeClassName(item.qualityFlag)}`}
                  >
                    {item.qualityFlag}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              {showDistractors ? (
                <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {formatDistractorRates(item.distractorRates)}
                </td>
              ) : null}
              <td className="px-3 py-2">
                {item.averageLatencyMs == null ? "—" : item.averageLatencyMs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
