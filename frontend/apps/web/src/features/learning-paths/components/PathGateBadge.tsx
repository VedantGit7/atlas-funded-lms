import { Badge } from "@atlas/design-system";

type GateBadgeProps = {
  gate: {
    id: string;
    gateType: string;
    state: "satisfied" | "locked" | "pending";
    config: Record<string, unknown>;
  };
  enrolledAt?: string | null | undefined;
};

function formatUnlockDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeBasedUnlockLabel(config: Record<string, unknown>, enrolledAt?: string | null): string {
  const availableFromRaw = config["availableFrom"];
  if (typeof availableFromRaw === "string" && !Number.isNaN(Date.parse(availableFromRaw))) {
    const availableFrom = new Date(availableFromRaw);
    const daysLeft = Math.ceil((availableFrom.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return daysLeft > 0
      ? `Unlocks in ${String(daysLeft)} day${daysLeft === 1 ? "" : "s"} (${formatUnlockDate(availableFrom)})`
      : `Unlocked on ${formatUnlockDate(availableFrom)}`;
  }

  const daysSinceEnrollRaw = config["daysSinceEnroll"];
  if (typeof daysSinceEnrollRaw === "number" && enrolledAt) {
    const unlockAt = new Date(
      new Date(enrolledAt).getTime() + daysSinceEnrollRaw * 24 * 60 * 60 * 1000,
    );
    const daysLeft = Math.ceil((unlockAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return daysLeft > 0
      ? `Unlocks in ${String(daysLeft)} day${daysLeft === 1 ? "" : "s"} (${formatUnlockDate(unlockAt)})`
      : `Unlocked on ${formatUnlockDate(unlockAt)}`;
  }

  return "Time-based unlock";
}

function gateLabel(gate: GateBadgeProps["gate"], enrolledAt?: string | null): string {
  if (gate.gateType === "competency_band") {
    const bandKey =
      typeof gate.config["bandKey"] === "string"
        ? gate.config["bandKey"]
        : typeof gate.config["minBandKey"] === "string"
          ? gate.config["minBandKey"]
          : "band";
    return `Competency band: ${bandKey}`;
  }

  if (gate.gateType === "time_based" && gate.state === "locked") {
    return timeBasedUnlockLabel(gate.config, enrolledAt);
  }

  return gate.gateType.replaceAll("_", " ");
}

export function PathGateBadge({ gate, enrolledAt }: GateBadgeProps) {
  const variant =
    gate.state === "satisfied" ? "success" : gate.state === "pending" ? "warning" : "default";
  const label = gateLabel(gate, enrolledAt);
  const showState = !(gate.gateType === "time_based" && gate.state === "locked");

  return (
    <Badge variant={variant}>
      {label}
      {showState ? ` · ${gate.state}` : ""}
    </Badge>
  );
}
