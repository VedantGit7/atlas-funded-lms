"use client";

import type { PublicTenantBranding } from "../../lib/server/public-tenant-branding";

type AuthShellProps = Readonly<{
  branding: PublicTenantBranding;
  requestId: string;
  children: React.ReactNode;
}>;

function themeColor(tokens: unknown, key: string, fallback: string): string {
  if (tokens && typeof tokens === "object" && key in tokens) {
    const value = (tokens as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

export function AuthShell({ branding, requestId, children }: AuthShellProps) {
  const primary = themeColor(branding.themeTokens, "primary", "#224466");
  const background = themeColor(branding.themeTokens, "background", "#f6f8fb");
  const foreground = themeColor(branding.themeTokens, "foreground", "#101010");

  return (
    <div
      className="auth-shell"
      style={{
        minHeight: "100vh",
        background,
        color: foreground,
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div
        className="auth-shell__panel"
        style={{
          width: "100%",
          maxWidth: "28rem",
          background: "#ffffff",
          border: "1px solid #d8dee8",
          borderRadius: "12px",
          padding: "2rem",
          boxShadow: "0 8px 24px rgba(16, 24, 40, 0.08)",
        }}
      >
        <header style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: primary,
            }}
          >
            {branding.issuerName ?? "Academy"}
          </p>
          <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.5rem" }}>
            {branding.publicName ?? "Sign in"}
          </h1>
        </header>

        <main>{children}</main>

        <footer style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#667085" }}>
          <span>Request ID: {requestId}</span>
        </footer>
      </div>
    </div>
  );
}
