import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@atlas/access";

describe("audit and outbox permission matrix", () => {
  it("grants audit.read to owner and admin tenant roles", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("audit.read");
    expect(ROLE_PERMISSIONS.admin).toContain("audit.read");
  });

  it("does not grant audit.read to learner, moderator, or instructor", () => {
    expect(ROLE_PERMISSIONS.learner).not.toContain("audit.read");
    expect(ROLE_PERMISSIONS.moderator).not.toContain("audit.read");
    expect(ROLE_PERMISSIONS.instructor).not.toContain("audit.read");
  });

  it("does not grant platform audit or dead-letter replay permissions through tenant roles", () => {
    for (const [roleKey, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(permissions, roleKey).not.toContain("platform.audit.read");
      expect(permissions, roleKey).not.toContain("platform.tenant.manage");
    }
  });
});
