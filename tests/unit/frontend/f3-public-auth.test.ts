import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("F3 public + auth forms", () => {
  it("includes public landing slug route and API module", () => {
    expect(existsSync(resolve(webRoot, "app/(public)/p/[slug]/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "modules/public/public-landing.server-api.ts"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/public/components/PublicLandingView.tsx"))).toBe(
      true,
    );

    const landingSource = readFileSync(
      resolve(webRoot, "features/public/components/PublicLandingView.tsx"),
      "utf8",
    );
    expect(landingSource).not.toMatch(/<main[\s>]/);
  });

  it("uses RHF + @atlas/contracts schemas in auth forms", () => {
    const authForms = [
      "app/(auth)/login/_components/LoginForm.tsx",
      "app/(auth)/signup/_components/SignupForm.tsx",
      "app/(auth)/reset-password/_components/PasswordResetForm.tsx",
      "features/diagnostics/components/DiagnosticIdentityGate.tsx",
    ];

    for (const relativePath of authForms) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toMatch(/use(?:Lazy)?ZodForm\(/);
      expect(source).toContain("@atlas/contracts/domain-identity/schemas");
    }

    const inviteSource = readFileSync(
      resolve(webRoot, "app/(auth)/invite/accept/_components/InviteAcceptCard.tsx"),
      "utf8",
    );
    expect(inviteSource).toContain("useActionState");
    expect(inviteSource).toContain('name="token"');
  });

  it("validates auth server actions with @atlas/contracts schemas", () => {
    const actions = [
      "app/(auth)/login/_actions/login-action.ts",
      "app/(auth)/login/_actions/verify-mfa-action.ts",
      "app/(auth)/signup/_actions/signup-action.ts",
      "app/(auth)/reset-password/_actions/reset-password-action.ts",
      "app/(auth)/invite/accept/_actions/accept-invitation-action.ts",
    ];

    for (const relativePath of actions) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toContain("@atlas/contracts/domain-identity/schemas");
      expect(source).toContain(".safeParse(");
    }
  });

  it("registers hidden auth fields for RHF submit", () => {
    const hiddenFieldForms = [
      "app/(auth)/login/_components/LoginForm.tsx",
      "app/(auth)/signup/_components/SignupForm.tsx",
    ];

    for (const relativePath of hiddenFieldForms) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toContain("HiddenFormField");
    }

    const loginSource = readFileSync(
      resolve(webRoot, "app/(auth)/login/_components/LoginForm.tsx"),
      "utf8",
    );
    expect(loginSource).toContain('name="redirectTo"');
    expect(loginSource).toContain("loginState.redirectTo");

    const signupSource = readFileSync(
      resolve(webRoot, "app/(auth)/signup/_components/SignupForm.tsx"),
      "utf8",
    );
    expect(signupSource).toContain('name="inviteToken"');

    const inviteSource = readFileSync(
      resolve(webRoot, "app/(auth)/invite/accept/_components/InviteAcceptCard.tsx"),
      "utf8",
    );
    expect(inviteSource).toContain('name="token"');
    expect(inviteSource).toContain('<input type="hidden"');
  });

  it("uses safe redirect helpers in login actions", () => {
    for (const relativePath of [
      "app/(auth)/login/_actions/login-action.ts",
      "app/(auth)/login/_actions/verify-mfa-action.ts",
    ]) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toContain("resolvePostAuthRedirect");
      expect(source).toContain("safe-redirect");
    }
  });
});
