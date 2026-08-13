import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Award,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CircleHelp,
  Globe,
  GraduationCap,
  Hash,
  Link2,
  MessageSquare,
  Palette,
  Route,
  Settings2,
  Smartphone,
  Star,
  Trash2,
  Trophy,
  Upload,
  UserMinus,
  Zap,
} from "lucide-react";

export type CourseSettingsCardId =
  | "branding"
  | "seo"
  | "tags"
  | "faqs"
  | "instructors"
  | "pricing-plans"
  | "android-pricing"
  | "ios-pricing"
  | "permissions"
  | "ratings-reviews"
  | "discussions-bookmarks"
  | "leaderboard"
  | "gamification"
  | "certificates"
  | "content-dripping"
  | "learner-configurations"
  | "learning-path"
  | "publish-course"
  | "move-to-trash"
  | "associated-contents"
  | "remove-learners";

export type CourseSettingsFormSection = "pricing-plans" | "content-dripping" | "learning-path";

export type CourseSettingsCard = {
  id: CourseSettingsCardId;
  title: string;
  description: string;
  icon: LucideIcon;
  available: boolean;
  destructive?: boolean;
  formSection?: CourseSettingsFormSection;
  lifecyclePanel?: "publish" | "archive";
  externalHref?: (courseId: string) => string;
};

export type CourseSettingsGroup = {
  id: string;
  title: string;
  subtitle: string;
  cards: CourseSettingsCard[];
};

export const COURSE_SETTINGS_GROUPS: CourseSettingsGroup[] = [
  {
    id: "general",
    title: "General",
    subtitle: "Setup general course settings",
    cards: [
      {
        id: "branding",
        title: "Branding",
        description: "Add details about your course and manage brand settings",
        icon: Palette,
        available: true,
      },
      {
        id: "seo",
        title: "SEO",
        description: "Add SEO details to help bring your course to the top of search results",
        icon: Globe,
        available: true,
      },
      {
        id: "tags",
        title: "Tags",
        description: "Add course tags to make the course easy to filter for learners",
        icon: Hash,
        available: true,
      },
      {
        id: "faqs",
        title: "FAQs",
        description: "Add and manage frequently asked questions for your course",
        icon: CircleHelp,
        available: true,
      },
      {
        id: "instructors",
        title: "Instructors",
        description: "Add instructors associated with the course",
        icon: GraduationCap,
        available: true,
      },
    ],
  },
  {
    id: "pricing-permissions",
    title: "Pricing & Permissions",
    subtitle: "Manage pricing and permission settings for your course",
    cards: [
      {
        id: "pricing-plans",
        title: "Pricing Plans",
        description: "Manage pricing and expiry details for your course",
        icon: Banknote,
        available: true,
      },
      {
        id: "android-pricing",
        title: "Android Pricing",
        description: "Set Android app pricing for your course",
        icon: Smartphone,
        available: true,
      },
      {
        id: "ios-pricing",
        title: "iOS Pricing",
        description: "Set iOS app pricing for your course",
        icon: Apple,
        available: true,
      },
      {
        id: "permissions",
        title: "Permissions",
        description: "Manage permission settings for your course",
        icon: BadgeCheck,
        available: true,
      },
    ],
  },
  {
    id: "features",
    title: "Features",
    subtitle: "Use course features to enhance your course",
    cards: [
      {
        id: "ratings-reviews",
        title: "Ratings & Reviews",
        description: "Course reviews allow learners to provide feedback about the course",
        icon: Star,
        available: true,
      },
      {
        id: "discussions-bookmarks",
        title: "Discussions & Bookmarks",
        description: "Allow learners to create discussions and bookmark important contents",
        icon: MessageSquare,
        available: true,
      },
      {
        id: "leaderboard",
        title: "Leaderboard",
        description: "Enable leaderboards to increase competition among learners",
        icon: Trophy,
        available: true,
      },
      {
        id: "gamification",
        title: "Gamification",
        description: "Override XP rewards for learning events in this course",
        icon: Zap,
        available: true,
      },
      {
        id: "certificates",
        title: "Certificates",
        description:
          "Enable course certification for your learners to issue certificates based on determined criteria",
        icon: Award,
        available: true,
      },
      {
        id: "content-dripping",
        title: "Content Dripping",
        description: "Configure content dripping to pre-schedule release of lessons",
        icon: CalendarClock,
        available: true,
      },
      {
        id: "learner-configurations",
        title: "Learner Configurations",
        description: "Configure learner gstin and invoice settings for this course",
        icon: Settings2,
        available: true,
      },
      {
        id: "learning-path",
        title: "Learning Path",
        description: "Make a sequential learning path for structured learning",
        icon: Route,
        available: true,
      },
    ],
  },
  {
    id: "publish-delete",
    title: "Publish / Delete Course",
    subtitle: "Delete or disable course and learners",
    cards: [
      {
        id: "publish-course",
        title: "Publish Course",
        description: "Publish/Unpublish the course for your learners",
        icon: Upload,
        available: true,
        lifecyclePanel: "publish",
      },
      {
        id: "move-to-trash",
        title: "Move To Trash",
        description:
          "Move this course to Trash. You can restore it within 7 days before it's permanently deleted.",
        icon: Trash2,
        available: true,
        destructive: true,
        lifecyclePanel: "archive",
      },
      {
        id: "associated-contents",
        title: "Associated Contents",
        description:
          "View all contents your product is associated with. Be it a bundle, segment, category or a subscription plan.",
        icon: Link2,
        available: true,
      },
      {
        id: "remove-learners",
        title: "Remove Learners",
        description: "Remove learners access from the course & delete their data",
        icon: UserMinus,
        available: true,
      },
    ],
  },
];

export function filterCourseSettingsGroups(query: string): CourseSettingsGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return COURSE_SETTINGS_GROUPS;

  return COURSE_SETTINGS_GROUPS.map((group) => ({
    ...group,
    cards: group.cards.filter(
      (card) =>
        card.title.toLowerCase().includes(normalized) ||
        card.description.toLowerCase().includes(normalized),
    ),
  })).filter((group) => group.cards.length > 0);
}

export const COURSE_GENERAL_SETTINGS_SECTIONS =
  COURSE_SETTINGS_GROUPS.find((group) => group.id === "general")?.cards ?? [];

export const COURSE_FEATURES_SETTINGS_SECTIONS =
  COURSE_SETTINGS_GROUPS.find((group) => group.id === "features")?.cards ?? [];

export const COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS =
  COURSE_SETTINGS_GROUPS.find((group) => group.id === "publish-delete")?.cards ?? [];

const GENERAL_SECTION_IDS = new Set<CourseSettingsCardId>(
  COURSE_GENERAL_SETTINGS_SECTIONS.map((card) => card.id),
);

const FEATURES_SECTION_IDS = new Set<CourseSettingsCardId>(
  COURSE_FEATURES_SETTINGS_SECTIONS.map((card) => card.id),
);

const PUBLISH_DELETE_SECTION_IDS = new Set<CourseSettingsCardId>(
  COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS.map((card) => card.id),
);

export function isCourseGeneralSettingsSection(
  sectionId: string | null,
): sectionId is CourseSettingsCardId {
  return sectionId != null && GENERAL_SECTION_IDS.has(sectionId as CourseSettingsCardId);
}

export function isCourseFeaturesSettingsSection(
  sectionId: string | null,
): sectionId is CourseSettingsCardId {
  return sectionId != null && FEATURES_SECTION_IDS.has(sectionId as CourseSettingsCardId);
}

export function isCoursePublishDeleteSettingsSection(
  sectionId: string | null,
): sectionId is CourseSettingsCardId {
  return sectionId != null && PUBLISH_DELETE_SECTION_IDS.has(sectionId as CourseSettingsCardId);
}

export function findCourseSettingsCard(cardId: string): CourseSettingsCard | undefined {
  for (const group of COURSE_SETTINGS_GROUPS) {
    const card = group.cards.find((item) => item.id === cardId);
    if (card) return card;
  }
  return undefined;
}
