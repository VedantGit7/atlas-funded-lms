type AnalyticsMetricCardProps = {
  label: string;
  value: number;
  description?: string;
};

export function AnalyticsMetricCard({ label, value, description }: AnalyticsMetricCardProps) {
  return (
    <article className="rounded border p-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="text-2xl font-semibold" aria-label={`${label} count`}>
        {value.toLocaleString()}
      </p>
      {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
    </article>
  );
}
