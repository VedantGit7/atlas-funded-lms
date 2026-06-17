import type { z } from "zod";
import type { TenantBrandingViewSchema } from "@atlas/domain-branding/schemas/branding";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";
import { mapTenantThemeToSemanticPayload } from "@atlas/domain-branding/utils/theme-semantic-tokens";

type BrandingView = z.infer<typeof TenantBrandingViewSchema>;
type ThemeView = z.infer<typeof TenantThemeViewSchema>;

type BrandPreviewProps = {
  branding: BrandingView;
  theme: ThemeView;
};

export function BrandPreview({ branding, theme }: BrandPreviewProps) {
  const semantic = mapTenantThemeToSemanticPayload(theme.tokens);
  const headline =
    typeof branding.publicLandingCopy?.["headline"] === "string"
      ? branding.publicLandingCopy["headline"]
      : null;

  return (
    <section
      aria-label="Brand preview"
      style={{
        border: "1px solid #d4d4d8",
        borderRadius: semantic.radius === "none" ? 0 : 8,
        overflow: "hidden",
        background: semantic.color.background ?? "#ffffff",
        color: semantic.color.foreground ?? "#101010",
      }}
    >
      <header
        style={{
          background: semantic.color.header ?? semantic.color.primary,
          color: "#ffffff",
          padding: "12px 16px",
        }}
      >
        <strong>{branding.publicName ?? branding.displayName}</strong>
      </header>
      <div style={{ padding: 16 }}>
        {headline ? <h2 style={{ marginTop: 0 }}>{headline}</h2> : null}
        <p style={{ marginBottom: 0 }}>{branding.issuerName ?? "Issuer name not configured"}</p>
        <button
          type="button"
          disabled
          style={{
            marginTop: 16,
            background: semantic.color.primary,
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
          }}
        >
          Preview action
        </button>
      </div>
      <footer style={{ padding: "8px 16px", fontSize: 12, color: "#52525b" }}>
        Status: {branding.status} · Theme v{theme.version}
      </footer>
    </section>
  );
}
