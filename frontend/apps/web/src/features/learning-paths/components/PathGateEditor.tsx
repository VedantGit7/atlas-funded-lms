import {
  DEFAULT_GATE_CLASS,
  GATE_TYPE_CONFIG,
  formatGateLabel,
} from "../learning-path-studio-shared";

type PathGateEditorProps = {
  gates: Array<{
    id: string;
    gateType: string;
    config: Record<string, unknown>;
  }>;
};

export function PathGateEditor({ gates }: PathGateEditorProps) {
  if (gates.length === 0) {
    return <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">No gates</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {gates.map((gate) => {
        const cfg = GATE_TYPE_CONFIG[gate.gateType];
        const label = formatGateLabel(gate.gateType, gate.config);
        return (
          <span
            key={gate.id}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg?.className ?? DEFAULT_GATE_CLASS}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
