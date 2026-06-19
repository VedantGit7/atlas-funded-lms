type PathGateEditorProps = {
  gates: Array<{
    id: string;
    gateType: string;
    config: Record<string, unknown>;
  }>;
};

export function PathGateEditor({ gates }: PathGateEditorProps) {
  if (gates.length === 0) {
    return <p className="mt-2 text-sm opacity-70">No gates configured.</p>;
  }

  return (
    <ul className="mt-2 space-y-1 text-sm">
      {gates.map((gate) => (
        <li key={gate.id}>
          {gate.gateType}
          {gate.gateType === "competency_band" && typeof gate.config["bandKey"] === "string"
            ? ` (${gate.config["bandKey"]})`
            : null}
        </li>
      ))}
    </ul>
  );
}
