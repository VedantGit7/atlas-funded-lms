type BadgeGridProps = {
  badges: Array<{
    id: string;
    key: string;
    name: string;
    iconKey: string | null;
    awarded?: boolean | undefined;
    awardedAt?: string | null | undefined;
  }>;
};

export function BadgeGrid({ badges }: BadgeGridProps) {
  if (badges.length === 0) {
    return (
      <section className="rounded border p-4">
        <h2 className="font-semibold">Badges</h2>
        <p className="mt-2 text-sm opacity-80">No badges configured yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded border p-4">
      <h2 className="font-semibold">Badges</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <li key={badge.id} className="rounded border p-3 text-sm">
            <p className="font-medium">{badge.name}</p>
            <p className="opacity-70">{badge.key}</p>
            <p className="mt-1">{badge.awarded ? "Earned" : "Locked"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
