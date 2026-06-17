import type { z } from "zod";
import type { BrandingVersionViewSchema } from "@atlas/domain-branding/schemas/branding";

type BrandingVersion = z.infer<typeof BrandingVersionViewSchema>;

type BrandingVersionHistoryProps = {
  versions: BrandingVersion[];
};

export function BrandingVersionHistory({ versions }: BrandingVersionHistoryProps) {
  return (
    <section aria-label="Branding version history">
      <h2>Version history</h2>
      {versions.length === 0 ? (
        <p>No published versions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Published at</th>
              <th scope="col">Published by</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id}>
                <td>v{version.version}</td>
                <td>{new Date(version.publishedAt).toLocaleString()}</td>
                <td>{version.publishedByMembershipId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
