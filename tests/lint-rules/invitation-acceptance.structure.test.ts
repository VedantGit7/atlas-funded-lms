import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("invitation acceptance e2e wiring", () => {
  it("includes invite acceptance screen files", () => {
    expect(existsSync(resolve(webRoot, "app/(auth)/invite/accept/page.tsx"))).toBe(true);
    expect(
      existsSync(resolve(webRoot, "app/(auth)/invite/accept/_components/InviteAcceptCard.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(webRoot, "app/(auth)/invite/accept/_actions/accept-invitation-action.ts")),
    ).toBe(true);
  });

  it("requires token query param in invite card", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(auth)/invite/accept/_components/InviteAcceptCard.tsx"),
      "utf8",
    );
    // The token is read on the server page from `searchParams` and passed down
    // as a required prop now, rather than pulled from the URL inside the client
    // component. Asserting the old client-side read reported the requirement
    // missing when it had moved to a better place.
    expect(source).toMatch(/token:\s*string/);
    expect(source).not.toMatch(/console\.(log|info|debug).*token/i);

    const page = readFileSync(resolve(webRoot, "app/(auth)/invite/accept/page.tsx"), "utf8");
    expect(page).toContain("searchParams");
    expect(page).toMatch(/token\?:\s*string/);
  });

  it("prompts unauthenticated users to login or signup", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(auth)/invite/accept/_components/InviteAcceptCard.tsx"),
      "utf8",
    );
    expect(source).toContain("/signup");
    expect(source).toContain("/login");
  });
});
