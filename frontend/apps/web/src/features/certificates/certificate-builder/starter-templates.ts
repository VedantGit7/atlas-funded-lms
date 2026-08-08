/**
 * Certificate Studio starter templates.
 *
 * The built-in design presets were cleared — add your own templates to
 * `BASE_STARTERS` below, or (for artwork-backed designs) to
 * `starter-templates-imagebg.ts`. Only the "Blank Canvas" start-from-scratch
 * entry remains so the create-new flow always has a defined document.
 */

import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { CATALOG_STARTERS } from "./starter-templates-catalog";
import { IMAGE_STARTERS } from "./starter-templates-imagebg";
import { SHOWCASE_STARTERS } from "./starter-templates-showcase";

const PAGE_LANDSCAPE = {
  width: 297,
  height: 210,
  unit: "mm" as const,
  orientation: "landscape" as const,
  safeMm: 10,
};

const DEFAULT_VARIABLES: CertificateDesignDocument["variables"] = [
  { key: "recipient_name", label: "Recipient name", sampleValue: "Alex Morgan" },
  { key: "course_title", label: "Course title", sampleValue: "Introduction to Trading" },
  { key: "issue_date", label: "Issue date", sampleValue: "18 July 2026" },
  { key: "score", label: "Score", sampleValue: "95" },
];

export type GalleryCategory =
  | "all"
  | "completion"
  | "achievement"
  | "participation"
  | "excellence"
  | "recognition"
  | "academic"
  | "corporate"
  | "milestones"
  | "assessment"
  | "learning-path";

/** Labels for gallery filter chips (home + templates pages). */
export const GALLERY_CATEGORY_CHIPS: Array<{ id: GalleryCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "completion", label: "Completion" },
  { id: "achievement", label: "Achievement" },
  { id: "participation", label: "Participation" },
  { id: "excellence", label: "Excellence" },
  { id: "recognition", label: "Recognition" },
  { id: "academic", label: "Academic" },
  { id: "corporate", label: "Corporate" },
  { id: "milestones", label: "Milestones" },
  { id: "assessment", label: "Assessment" },
  { id: "learning-path", label: "Learning path" },
];

export type StarterPreviewKind =
  | "blank"
  | "achievement"
  | "mastery"
  | "legacy"
  | "classic"
  | "modern"
  | "branded"
  | "honorable"
  | "corporate"
  | "gold"
  | "completion"
  | "participation"
  | "excellence"
  | "recognition"
  | "assessment"
  | "path";

export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  /** Home "Start a new design" row */
  homeFeatured?: boolean;
  /** Mini preview variant (fallback only; real designs render their document) */
  previewKind: StarterPreviewKind;
  category: Exclude<GalleryCategory, "all">;
  document: CertificateDesignDocument;
};

function blankDocument(): CertificateDesignDocument {
  return {
    schemaVersion: 1,
    page: PAGE_LANDSCAPE,
    background: { type: "color", value: "#FFFDF8" },
    brandKitRef: null,
    variables: DEFAULT_VARIABLES,
    rules: [],
    elements: [],
  };
}

const BASE_STARTERS: StarterTemplate[] = [
  {
    id: "blank-canvas",
    name: "Blank Canvas",
    description: "Empty cream paper, ready for your layout.",
    homeFeatured: true,
    previewKind: "blank",
    category: "corporate",
    document: blankDocument(),
  },
];

/** Base starters + any catalog / showcase / image-backed templates. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  ...IMAGE_STARTERS,
  ...BASE_STARTERS,
  ...CATALOG_STARTERS,
  ...SHOWCASE_STARTERS,
];

export function getHomeStarters(): StarterTemplate[] {
  return STARTER_TEMPLATES.filter((s) => s.homeFeatured);
}

export function getGalleryStarters(category: GalleryCategory): StarterTemplate[] {
  if (category === "all") return STARTER_TEMPLATES.filter((s) => s.id !== "blank-canvas");
  return STARTER_TEMPLATES.filter((s) => s.category === category && s.id !== "blank-canvas");
}

export function findStarterById(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((s) => s.id === id);
}
