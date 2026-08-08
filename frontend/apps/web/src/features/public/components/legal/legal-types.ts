export type LegalContentBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type LegalSection = {
  id: string;
  sectionNumber: string;
  title: string;
  blocks: LegalContentBlock[];
};

export type LegalDocument = {
  slug: "terms" | "privacy";
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
};
