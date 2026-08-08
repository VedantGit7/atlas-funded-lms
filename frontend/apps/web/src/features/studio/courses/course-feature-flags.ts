import type { z } from "zod";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { parseCourseAccessFromTags } from "./course-access-settings";
import { courseLeaderboardFromTags, isCourseLeaderboardEnabled } from "./course-leaderboard-settings";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

export type CourseFeatureFlag = {
  id: string;
  label: string;
  enabled: boolean;
};

const STUDIO_FEATURES_TAG_KEY = "studioFeatures";

function readStudioFeature(tags: Record<string, unknown> | undefined, key: string): boolean | null {
  const features = tags?.[STUDIO_FEATURES_TAG_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return null;
  }

  const value = (features as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function feature(
  id: string,
  label: string,
  enabled: boolean,
  override: boolean | null,
): CourseFeatureFlag {
  return { id, label, enabled: override ?? enabled };
}

export function deriveCourseFeatureFlags(course: CourseRow): CourseFeatureFlag[] {
  const access = parseCourseAccessFromTags(course.tags);
  const tags = course.tags;
  const isPaid = course.accessTier === "PAID";
  const isPublished = course.status === "PUBLISHED";

  return [
    feature("content-dripping", "Content Dripping", access.dripEnabled, readStudioFeature(tags, "contentDripping")),
    feature("discussion", "Discussion", true, readStudioFeature(tags, "discussion")),
    feature("notes", "Notes", true, readStudioFeature(tags, "notes")),
    feature("certificate", "Certificate", false, readStudioFeature(tags, "certificate")),
    feature(
      "leaderboard",
      "Leaderboard",
      false,
      isCourseLeaderboardEnabled(courseLeaderboardFromTags(tags)) || null,
    ),
    feature(
      "ratings-reviews",
      "Ratings & Reviews",
      false,
      readStudioFeature(tags, "ratingsReviews"),
    ),
    feature(
      "enroll-on-signup",
      "Enroll on signup",
      access.accessMode === "open",
      readStudioFeature(tags, "enrollOnSignup"),
    ),
    feature("sell-independently", "Sell Independently", isPaid, readStudioFeature(tags, "sellIndependently")),
    feature(
      "sell-only-mobile",
      "Sell Only on Mobile",
      false,
      readStudioFeature(tags, "sellOnlyOnMobile"),
    ),
    feature("encrypted", "Encrypted", false, readStudioFeature(tags, "encrypted")),
    feature(
      "public-course",
      "Public Course",
      isPublished && access.accessMode === "open",
      readStudioFeature(tags, "publicCourse"),
    ),
  ];
}
