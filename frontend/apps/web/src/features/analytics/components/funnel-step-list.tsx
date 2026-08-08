type FunnelStep = {
  stageKey: string;
  count: number;
};

type FunnelStepListProps = {
  stages: FunnelStep[];
  title: string;
};

function formatStageLabel(stageKey: string): string {
  return stageKey.replaceAll("_", " ");
}

export function FunnelStepList({ stages, title }: FunnelStepListProps) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <section aria-labelledby="funnel-step-list-heading" className="space-y-3">
      <h3 id="funnel-step-list-heading" className="text-base font-medium">
        {title}
      </h3>
      <ol className="space-y-2">
        {stages.map((stage) => {
          const widthPercent = Math.max(8, Math.round((stage.count / maxCount) * 100));
          return (
            <li key={stage.stageKey} className="rounded border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{formatStageLabel(stage.stageKey)}</span>
                <span aria-label={`${formatStageLabel(stage.stageKey)} count`}>{stage.count}</span>
              </div>
              <div
                className="mt-2 h-2 rounded bg-neutral-200"
                role="img"
                aria-label={`${formatStageLabel(stage.stageKey)} volume bar`}
              >
                <div
                  className="h-2 rounded bg-neutral-700"
                  style={{ width: `${String(widthPercent)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
