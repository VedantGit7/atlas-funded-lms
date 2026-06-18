import type { TenantUnavailableReason } from "../../../lib/server/tenant-state-gate";
import type { PublicTenantBranding } from "../../../lib/server/public-tenant-branding";

type TenantUnavailableProps = Readonly<{
  branding: PublicTenantBranding;
  reason: TenantUnavailableReason;
  requestId: string;
}>;

const MESSAGES: Record<TenantUnavailableReason, { title: string; description: string }> = {
  PROVISIONING: {
    title: "Academy is being set up",
    description: "This academy is not available yet. Please check back soon.",
  },
  SUSPENDED: {
    title: "Academy temporarily unavailable",
    description:
      "Access to this academy is currently suspended. Contact your academy administrator.",
  },
  ARCHIVED: {
    title: "Academy unavailable",
    description: "This academy is no longer available.",
  },
  DOMAIN_INACTIVE: {
    title: "Academy unavailable",
    description: "This address is not currently serving an active academy.",
  },
};

export function TenantUnavailable({ branding, reason, requestId }: TenantUnavailableProps) {
  const copy = MESSAGES[reason];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background: "#f6f8fb",
      }}
    >
      <section
        aria-labelledby="tenant-unavailable-title"
        style={{
          width: "100%",
          maxWidth: "32rem",
          background: "#ffffff",
          border: "1px solid #d8dee8",
          borderRadius: "12px",
          padding: "2rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#667085" }}>
          {branding.publicName ?? branding.issuerName ?? "Academy"}
        </p>
        <h1 id="tenant-unavailable-title" style={{ marginTop: "0.5rem" }}>
          {copy.title}
        </h1>
        <p>{copy.description}</p>
        <p style={{ fontSize: "0.75rem", color: "#667085" }}>Request ID: {requestId}</p>
        <p style={{ marginTop: "1.5rem" }}>
          <a href="/login">Admin sign in</a>
        </p>
      </section>
    </div>
  );
}
