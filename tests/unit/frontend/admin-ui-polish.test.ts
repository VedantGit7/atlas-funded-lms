import { describe, expect, it } from "vitest";
import { lessonAssetLabel } from "../../../frontend/apps/web/src/features/lessons/lesson-asset-label";
import { courseUpdatedLabel } from "../../../frontend/apps/web/src/features/studio/courses/courses-catalog-shared";
import { createPricingPlanDraftFromKind } from "../../../frontend/apps/web/src/features/studio/courses/course-pricing-plan-settings";
import { courseRatingsReviewsFromDetail } from "../../../frontend/apps/web/src/features/studio/courses/course-ratings-reviews-settings";
import { courseTakesReviews } from "../../../backend/apps/api/src/server/reviews/reviews.service";

/** QA S2.6: admin UI polish. */
describe("admin UI polish (S2.6)", () => {
  it("names link attachments by title or address, never just 'link' (m30)", () => {
    expect(lessonAssetLabel({ assetType: "link", fileName: "Trading plan template" })).toBe(
      "Trading plan template",
    );
    expect(
      lessonAssetLabel({ assetType: "link", externalUrl: "https://www.example.com/guide/" }),
    ).toBe("example.com/guide");
    expect(lessonAssetLabel({ assetType: "link", externalUrl: "https://example.com/" })).toBe(
      "example.com",
    );
    expect(lessonAssetLabel({ assetType: "link" })).toBe("Link");
    expect(lessonAssetLabel({ assetType: "application/pdf", fileName: "notes.pdf" })).toBe(
      "notes.pdf",
    );
  });

  it("says when a course card was updated, not a bare '1 Day' (m28)", () => {
    const now = Date.UTC(2026, 10, 26, 12);
    expect(courseUpdatedLabel("2026-11-26T08:00:00.000Z", now)).toBe("Updated today");
    expect(courseUpdatedLabel("2026-11-25T08:00:00.000Z", now)).toBe("Updated yesterday");
    expect(courseUpdatedLabel("2026-11-20T08:00:00.000Z", now)).toBe("Updated 6 days ago");
    expect(courseUpdatedLabel("not a date", now)).toBe("Updated recently");
  });

  it("starts a new pricing plan with an empty title, not text to type over (M24)", () => {
    const course = { priceCents: 49900, currency: "INR" } as Parameters<
      typeof createPricingPlanDraftFromKind
    >[0];
    for (const kind of ["FREE", "ONE_TIME", "LIMITED_TIME"] as const) {
      expect(createPricingPlanDraftFromKind(course, [], kind).title).toBe("");
    }
  });

  it("takes ratings and reviews unless the course turned them off, in Studio and on the server (m32)", () => {
    const off = { tags: { studioFeatures: { ratingsReviews: false } } };
    const on = { tags: { studioFeatures: { ratingsReviews: true } } };
    expect(courseTakesReviews(null)).toBe(true);
    expect(courseTakesReviews({})).toBe(true);
    expect(courseTakesReviews(on)).toBe(true);
    expect(courseTakesReviews(off)).toBe(false);

    type Detail = Parameters<typeof courseRatingsReviewsFromDetail>[0];
    expect(courseRatingsReviewsFromDetail({ tags: {} } as Detail).enabled).toBe(true);
    expect(courseRatingsReviewsFromDetail({ tags: off.tags } as Detail).enabled).toBe(false);
  });
});
