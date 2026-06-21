import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";

type EntitlementsListProps = {
  entitlements: EntitlementView[];
};

export function EntitlementsList({ entitlements }: EntitlementsListProps) {
  return (
    <section className="space-y-4">
      <p className="text-sm opacity-80">
        Effective tenant entitlements are read-only. Entitlement changes are managed by platform
        policy.
      </p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Tenant entitlements (read-only)</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-4">
              Key
            </th>
            <th scope="col" className="py-2 pr-4">
              Enabled
            </th>
            <th scope="col" className="py-2 pr-4">
              Value
            </th>
            <th scope="col" className="py-2">
              Expires
            </th>
          </tr>
        </thead>
        <tbody>
          {entitlements.map((entry) => (
            <tr key={entry.key} className="border-b">
              <td className="py-3 pr-4 font-mono">{entry.key}</td>
              <td className="py-3 pr-4">{entry.enabled ? "Yes" : "No"}</td>
              <td className="py-3 pr-4">
                {entry.value == null ? "—" : JSON.stringify(entry.value)}
              </td>
              <td className="py-3">{entry.expiresAt ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
