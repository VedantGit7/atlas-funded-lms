type ItemStatisticRow = {
  itemReference: { itemId: string; label: string };
  attemptsCount: number;
  correctCount: number;
  accuracy: number | null;
  averageLatencyMs: number | null;
};

type ItemStatisticsTableProps = {
  items: ItemStatisticRow[];
  caption: string;
};

export function ItemStatisticsTable({ items, caption }: ItemStatisticsTableProps) {
  if (items.length === 0) {
    return <p>No item performance data is available for this assessment yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left font-medium">{caption}</caption>
        <thead>
          <tr className="border-b">
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
              Avg latency (ms)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemReference.itemId} className="border-b">
              <td className="px-3 py-2">{item.itemReference.label}</td>
              <td className="px-3 py-2">{item.attemptsCount}</td>
              <td className="px-3 py-2">{item.correctCount}</td>
              <td className="px-3 py-2">
                {item.accuracy == null ? "—" : `${String(Math.round(item.accuracy * 100))}%`}
              </td>
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
