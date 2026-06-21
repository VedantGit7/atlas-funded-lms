import { describe, expect, it } from "vitest";
import { isAppealSelfReviewBlocked } from "../../../apps/web/src/features/moderation/moderation-self-review";

describe("appeal self-review helper", () => {
  it("blocks review when viewer submitted the appeal", () => {
    expect(
      isAppealSelfReviewBlocked({
        viewerMembershipId: "11111111-1111-4111-8111-111111111111",
        submittedByMembershipId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe(true);
  });

  it("allows review for a different membership", () => {
    expect(
      isAppealSelfReviewBlocked({
        viewerMembershipId: "11111111-1111-4111-8111-111111111111",
        submittedByMembershipId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe(false);
  });
});
