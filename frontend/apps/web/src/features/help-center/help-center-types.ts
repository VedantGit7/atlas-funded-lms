import type { LucideIcon } from "lucide-react";

export type HelpCategoryId =
  | "getting-started"
  | "courses"
  | "certificates"
  | "diagnostics"
  | "billing"
  | "account"
  | "troubleshooting";

export type HelpContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "step"; number: number; title: string; body: string }
  | { type: "callout"; variant: "tip" | "note" | "warning"; title?: string; text: string };

export type HelpArticleSection = {
  id: string;
  title: string;
  blocks: HelpContentBlock[];
};

export type HelpArticle = {
  slug: string;
  categoryId: HelpCategoryId;
  title: string;
  summary: string;
  lastUpdated: string;
  readMinutes: number;
  popular?: boolean;
  relatedSlugs?: string[];
  sections: HelpArticleSection[];
};

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type HelpSearchResult = {
  slug: string;
  title: string;
  summary: string;
  categoryId: HelpCategoryId;
  categoryTitle: string;
};

export type HelpTipOfWeek = {
  label: string;
  body: string;
};
