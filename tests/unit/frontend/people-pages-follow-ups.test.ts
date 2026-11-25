import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PublicMfaVerifyRequestSchema } from "../../../backend/packages/domain/identity/src/schemas/public-auth";
import { gateBadgeText } from "../../../frontend/apps/web/src/features/learning-paths/components/PathGateBadge";
import { pageDocumentTitle } from "../../../frontend/apps/web/src/lib/branding/page-title";

const gate = (gateType: string, state: "satisfied" | "locked" | "pending", config = {}) => ({
  id: "g1",
  gateType,
  state,
  config,
});

describe("S1.15 follow-ups", () => {
  it("words learning path gates plainly (QA review 2 H19)", () => {
    expect(gateBadgeText(gate("open", "satisfied"))).toBe("Open to everyone");
    expect(gateBadgeText(gate("previous_step_completed", "locked"))).toBe(
      "Finish the step before · not yet",
    );
    expect(gateBadgeText(gate("assessment_passed", "satisfied"))).toBe(
      "Pass the assessment · done",
    );
    expect(gateBadgeText(gate("manual", "pending"))).toBe("Approval from your academy · waiting");
    expect(gateBadgeText(gate("competency_band", "locked", { bandKey: "advanced" }))).toBe(
      "Reach the advanced competency band · not yet",
    );
  });

  it("names learner pages that have no menu entry in the tab title", () => {
    expect(pageDocumentTitle("/paths/abc", "Northwind LMS")).toBe("Learning paths · Northwind LMS");
    expect(pageDocumentTitle("/profile/subscription", "Northwind LMS")).toBe(
      "Profile · Northwind LMS",
    );
  });

  it("asks for the authenticator code in plain words", () => {
    const result = PublicMfaVerifyRequestSchema.safeParse({ code: "12" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Enter the 6-digit code from your authenticator app.",
    );
    expect(PublicMfaVerifyRequestSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("keeps the request ID out of the admin shell's visible and spoken text", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../frontend/apps/web/src/components/shells/admin/AdminShell.tsx"),
      "utf8",
    );
    expect(source).not.toContain("Request ID: {requestId}");
    expect(source).toContain("data-request-id={requestId}");
  });
});
