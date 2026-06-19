type GateBadgeProps = {
  gate: {
    id: string;
    gateType: string;
    state: "satisfied" | "locked" | "pending";
    config: Record<string, unknown>;
  };
};

function gateLabel(gate: GateBadgeProps["gate"]): string {
  if (gate.gateType === "competency_band") {
    const bandKey =
      typeof gate.config["bandKey"] === "string"
        ? gate.config["bandKey"]
        : typeof gate.config["minBandKey"] === "string"
          ? gate.config["minBandKey"]
          : "band";
    return `Competency band: ${bandKey}`;
  }

  return gate.gateType.replaceAll("_", " ");
}

export function PathGateBadge({ gate }: GateBadgeProps) {
  const tone =
    gate.state === "satisfied"
      ? "bg-green-100 text-green-900"
      : gate.state === "pending"
        ? "bg-yellow-100 text-yellow-900"
        : "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs ${tone}`}>
      {gateLabel(gate)} · {gate.state}
    </span>
  );
}
