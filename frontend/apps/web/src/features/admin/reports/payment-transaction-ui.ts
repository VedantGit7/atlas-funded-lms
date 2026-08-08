export function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;
}

export function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAbsolute(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDayClock(iso: string | null): { day: string; time: string } {
  if (!iso) return { day: "—", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
  return {
    day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

export function statusBadge(status: string): { className: string; label: string } {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "succeeded" || normalized === "success") {
    return {
      label: "PAID",
      className:
        "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)]",
    };
  }
  if (normalized === "failed" || normalized === "failure" || normalized === "declined") {
    return {
      label: "FAILED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)]",
    };
  }
  if (normalized.includes("refund")) {
    return {
      label: "REFUNDED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_35%,transparent)]",
    };
  }
  return {
    label: status.toUpperCase() || "PENDING",
    className:
      "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)] border-[var(--admin-border)]",
  };
}
