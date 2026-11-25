import { formatNumber } from "../../../lib/format/academy-format";

type AnalyticsMetricCardProps = {
  label: string;
  value: number;
  description?: string | undefined;
};

export function AnalyticsMetricCard({ label, value, description }: AnalyticsMetricCardProps) {
  return (
    <article className="rounded border p-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="text-2xl font-semibold" aria-label={`${label} count`}>
        {formatNumber(value)}
      </p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </article>
  );
}
