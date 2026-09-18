import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const authPaths = [
  "app/(auth)/layout.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/login/_components/LoginForm.tsx",
  "app/(auth)/login/_actions/login-action.ts",
  "app/(auth)/signup/page.tsx",
  "app/(auth)/signup/_components/SignupForm.tsx",
  "app/(auth)/signup/_actions/signup-action.ts",
  "app/(auth)/reset-password/page.tsx",
  "app/(auth)/reset-password/_components/PasswordResetForm.tsx",
  "app/(auth)/reset-password/_actions/reset-password-action.ts",
  "components/shells/AuthShell.tsx",
  "lib/server/tenant-state-gate.ts",
  "lib/server/public-tenant-branding.ts",
];

describe("auth login signup reset e2e wiring", () => {
  it("includes approved auth screen files", () => {
    for (const relativePath of authPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("does not render protected nav in AuthShell", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/AuthShell.tsx"), "utf8");
    expect(source).not.toMatch(/LearnerShell|StudioShell|TenantAdminShell|admin\/members/i);
  });

  it("uses generic login errors in login form action", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(auth)/login/_actions/login-action.ts"),
      "utf8",
    );
    expect(source).toContain("GENERIC_LOGIN_ERROR_MESSAGE");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("password reset uses generic success copy", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(auth)/reset-password/_actions/reset-password-action.ts"),
      "utf8",
    );
    expect(source).toContain("GENERIC_PASSWORD_RESET_MESSAGE");
  });
});
