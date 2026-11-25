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
    return `Reach the ${bandKey.replaceAll("_", " ")} competency band`;
  }

  if (gate.gateType === "time_based" && gate.state === "locked") {
    return timeBasedUnlockLabel(gate.config, enrolledAt);
  }

  return GATE_REQUIREMENT[gate.gateType] ?? "Unlock condition";
}

/**
 * What the learner has to do, in plain words (QA review 2 H19: the badge read
 * "open · satisfied").
 */
const GATE_REQUIREMENT: Record<string, string> = {
  open: "Open to everyone",
  previous_step_completed: "Finish the step before",
  assessment_passed: "Pass the assessment",
  manual: "Approval from your academy",
  time_based: "Unlocks after a set time",
};

const GATE_STATE: Record<GateBadgeProps["gate"]["state"], string> = {
  satisfied: "done",
  locked: "not yet",
  pending: "waiting",
};

/** The badge text, e.g. "Pass the assessment · not yet". */
export function gateBadgeText(gate: GateBadgeProps["gate"], enrolledAt?: string | null): string {
  const label = gateLabel(gate, enrolledAt);
  // "Open to everyone" needs no state; a locked time gate already says when.
  const showState =
    gate.gateType !== "open" && !(gate.gateType === "time_based" && gate.state === "locked");
  return showState ? `${label} · ${GATE_STATE[gate.state]}` : label;
}

export function PathGateBadge({ gate, enrolledAt }: GateBadgeProps) {
  const variant =
    gate.state === "satisfied" ? "success" : gate.state === "pending" ? "warning" : "default";
  return <Badge variant={variant}>{gateBadgeText(gate, enrolledAt)}</Badge>;
}
