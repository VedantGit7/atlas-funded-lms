export function ShellNavBadge({ count }: { count: number | null }) {
  if (count == null || count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} pending`}
      className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-xs text-background"
    >
      {count}
    </span>
  );
}
