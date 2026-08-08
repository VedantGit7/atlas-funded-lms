type TrendRow = {
  rollupKey: string;
  periodStart: string;
  count: number;
};

type AnalyticsTrendTableProps = {
  rows: TrendRow[];
  caption: string;
};

function formatRollupLabel(key: string): string {
  return key.replaceAll("_", " ");
}

export function AnalyticsTrendTable({ rows, caption }: AnalyticsTrendTableProps) {
  if (rows.length === 0) {
    return <p>No trend data is available for the selected range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left font-medium">{caption}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-3 py-2">
              Metric
            </th>
            <th scope="col" className="px-3 py-2">
              Period
            </th>
            <th scope="col" className="px-3 py-2">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rollupKey}-${row.periodStart}`} className="border-b">
              <td className="px-3 py-2">{formatRollupLabel(row.rollupKey)}</td>
              <td className="px-3 py-2">{new Date(row.periodStart).toLocaleDateString()}</td>
              <td className="px-3 py-2">{row.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
