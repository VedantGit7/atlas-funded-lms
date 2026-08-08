import { EmptyState } from "@atlas/design-system";

type LocalesBackendUnavailableTabProps = {
  title: string;
  description: string;
  requirements: string[];
};

export function LocalesBackendUnavailableTab({
  title,
  description,
  requirements,
}: LocalesBackendUnavailableTabProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
      <EmptyState
        title={title}
        description={description}
        className="max-w-lg border-[var(--admin-border)] bg-[var(--admin-surface)] [&_h2]:text-[var(--admin-on-surface)] [&_p]:text-[var(--admin-on-surface-variant)]"
        action={
          <ul className="mt-2 max-w-md space-y-1 text-left text-xs text-[var(--admin-on-surface-variant)]">
            {requirements.map((item) => (
              <li key={item} className="font-mono">
                {item}
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
