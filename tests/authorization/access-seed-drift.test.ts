import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@atlas/access";

describe("access seed drift guard", () => {
  it("never grants platform permissions through tenant role seeds", () => {
    for (const [roleKey, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(
          permission.startsWith("platform."),
          `${roleKey} must not include ${permission}`,
        ).toBe(false);
      }
    }
  });

  it("keeps learner role non-admin", () => {
    expect(ROLE_PERMISSIONS.learner).not.toContain("membership.read");
    expect(ROLE_PERMISSIONS.learner).not.toContain("role.assign");
    expect(ROLE_PERMISSIONS.learner).not.toContain("branding.update");
    expect(ROLE_PERMISSIONS.learner).not.toContain("audit.read");
  });
});
