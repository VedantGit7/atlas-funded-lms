import { describe, expect, it } from "vitest";
import {
  duplicateKey,
  findDuplicateGroups,
  findDuplicateIds,
  findNearDuplicates,
  findSlugClash,
  formatTagRelative,
  formatTagTimestamp,
  groupKeyFor,
  sortTags,
  suggestSurvivor,
  tagAuditActionLabel,
  usageLabel,
  visibilityCaption,
  visibilityLabel,
} from "../../../frontend/apps/web/src/features/admin/tags/tags-shared";
import { slugifyTagTitle } from "../../../frontend/apps/web/src/features/admin/tags/tags-api";
import type { Tag } from "../../../frontend/apps/web/src/features/admin/tags/tags-api";

/**
 * The derived parts of the tag console.
 *
 * All of it is client-side because the list endpoint is deliberately
 * unpaginated, which makes these functions the whole of the screen's search,
 * ordering and duplicate detection rather than a cosmetic layer over a server
 * that already did the work.
 */

function tag(overrides: Partial<Tag> & { id: string; title: string }): Tag {
  return {
    slug: slugifyTagTitle(overrides.title),
    description: null,
    visibility: "public",
    ...overrides,
  };
}

describe("duplicate detection", () => {
  it("treats case, punctuation and a trailing plural as the same tag", () => {
    expect(duplicateKey("Beginner")).toBe(duplicateKey("beginners"));
    expect(duplicateKey("Risk management")).toBe(duplicateKey("risk-management"));
    expect(duplicateKey("Prop firm rules")).toBe(duplicateKey("Prop Firm Rule"));
  });

  it("does not collapse genuinely different tags", () => {
    expect(duplicateKey("Beginner")).not.toBe(duplicateKey("Advanced"));
    // Short words keep their trailing "s", so "Ops" does not collapse to "Op".
    expect(duplicateKey("Ops")).not.toBe(duplicateKey("Op"));
    // A sibilant stem is the only place an "es" plural is stripped.
    expect(duplicateKey("Classes")).toBe(duplicateKey("Class"));
  });

  it("flags every member of a duplicate group and nothing else", () => {
    const tags = [
      tag({ id: "a", title: "Beginner" }),
      tag({ id: "b", title: "Beginners" }),
      tag({ id: "c", title: "Advanced" }),
    ];

    const flagged = findDuplicateIds(tags);
    expect(flagged).toEqual(new Set(["a", "b"]));
  });

  it("ignores a title that normalises to nothing", () => {
    // A title of only punctuation must not bucket with every other such title
    // and produce a page of false duplicates.
    const tags = [tag({ id: "a", title: "—" }), tag({ id: "b", title: "·" })];
    expect(findDuplicateIds(tags).size).toBe(0);
  });
});

describe("sorting", () => {
  const tags = [
    tag({ id: "a", title: "Beta", usage: { courses: 1, lessons: 1 } }),
    tag({ id: "b", title: "Alpha", usage: { courses: 0, lessons: 5 } }),
    tag({ id: "c", title: "Gamma", usage: { courses: 0, lessons: 0 } }),
  ];

  it("orders by name in both directions", () => {
    expect(sortTags(tags, "title-asc").map((entry) => entry.title)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(sortTags(tags, "title-desc").map((entry) => entry.title)).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);
  });

  it("orders by total attachments, not by either count alone", () => {
    expect(sortTags(tags, "usage-desc").map((entry) => entry.title)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("breaks ties on the name so the order does not reshuffle between refreshes", () => {
    const tied = [
      tag({ id: "a", title: "Zulu", usage: { courses: 1, lessons: 0 } }),
      tag({ id: "b", title: "Alpha", usage: { courses: 1, lessons: 0 } }),
    ];
    expect(sortTags(tied, "usage-desc").map((entry) => entry.title)).toEqual(["Alpha", "Zulu"]);
  });

  it("does not mutate the array it was given", () => {
    const original = [...tags];
    sortTags(tags, "title-desc");
    expect(tags).toEqual(original);
  });
});

describe("alphabetical grouping", () => {
  it("files a tag under its first letter, and everything else under #", () => {
    expect(groupKeyFor(tag({ id: "a", title: "beginner" }))).toBe("B");
    expect(groupKeyFor(tag({ id: "b", title: "  Risk" }))).toBe("R");
    expect(groupKeyFor(tag({ id: "c", title: "2024 intake" }))).toBe("#");
  });
});

describe("usage copy", () => {
  it("names both kinds of attachment, singular and plural", () => {
    expect(usageLabel({ courses: 1, lessons: 0 })).toBe("1 course");
    expect(usageLabel({ courses: 2, lessons: 3 })).toBe("2 courses · 3 lessons");
  });

  it("says a tag is unattached rather than rendering a bare zero", () => {
    expect(usageLabel({ courses: 0, lessons: 0 })).toBe("Not attached");
  });

  it("shows an em dash when the count was never fetched, never a zero", () => {
    // "0 uses" for a tag whose usage simply was not loaded is the exact lie
    // this module used to tell.
    expect(usageLabel(undefined)).toBe("—");
  });
});

describe("visibility", () => {
  it("labels all three stored values", () => {
    expect(visibilityLabel("public")).toBe("Public");
    expect(visibilityLabel("private")).toBe("Private");
    expect(visibilityLabel("classification")).toBe("Classification");
  });

  it("captions classification without inventing a taxonomy for the academy", () => {
    expect(visibilityCaption("classification")).toMatch(/up to this academy/i);
  });
});

describe("slug preview", () => {
  it("matches what the server derives from a title", () => {
    expect(slugifyTagTitle("Risk Management")).toBe("risk-management");
    expect(slugifyTagTitle("  Prop firm — rules!  ")).toBe("prop-firm-rules");
    expect(slugifyTagTitle("///")).toBe("");
  });
});

describe("create-screen duplicate guard", () => {
  const existing = [
    tag({ id: "a", title: "Beginner" }),
    tag({ id: "b", title: "Risk management" }),
  ];

  it("blocks on the slug a live tag already holds", () => {
    // Two different titles can derive the same slug, which is why the guard
    // compares slugs rather than titles.
    expect(findSlugClash(existing, slugifyTagTitle("Risk  Management"))?.id).toBe("b");
    expect(findSlugClash(existing, slugifyTagTitle("Position sizing"))).toBeNull();
  });

  it("never treats an empty slug as a clash", () => {
    // An empty slug is its own error; reporting it as "already taken" would
    // send the operator looking for a tag that does not exist.
    expect(findSlugClash(existing, "")).toBeNull();
  });

  it("warns on a plural or re-cased spelling of an existing tag", () => {
    expect(findNearDuplicates(existing, "beginners").map((entry) => entry.id)).toEqual(["a"]);
    expect(findNearDuplicates(existing, "Advanced")).toEqual([]);
  });

  it("excludes the exact clash, which is reported separately and harder", () => {
    // Otherwise an exact collision renders twice: once as a block and once as
    // a softer warning that contradicts it.
    expect(findNearDuplicates(existing, "Risk management", "b")).toEqual([]);
  });

  it("says nothing while the title is still empty", () => {
    expect(findNearDuplicates(existing, "   ")).toEqual([]);
  });
});

describe("detail-screen formatting", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("renders a relative time the operator actually reads", () => {
    expect(formatTagRelative("2026-08-24T11:30:00.000Z", now)).toMatch(/30 minutes ago/);
    expect(formatTagRelative("2026-08-22T12:00:00.000Z", now)).toMatch(/2 days ago/);
    expect(formatTagRelative("2026-05-24T12:00:00.000Z", now)).toMatch(/3 months ago/);
  });

  it("returns an empty string for an unparseable timestamp rather than NaN", () => {
    // "Invalid Date ago" in a metadata block reads as a system fault.
    expect(formatTagRelative("not-a-date", now)).toBe("");
  });

  it("falls back to the raw value when an absolute timestamp will not parse", () => {
    expect(formatTagTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("labels the tag audit actions in plain English", () => {
    expect(tagAuditActionLabel("tag.create")).toBe("Created");
    expect(tagAuditActionLabel("tag.merge")).toBe("Another tag merged into this one");
  });

  it("shows an unrecognised action rather than hiding it", () => {
    // Swallowing an action this screen has not been taught about would make the
    // history quietly incomplete, which is worse than an ugly identifier.
    expect(tagAuditActionLabel("tag.something.new")).toBe("tag.something.new");
  });
});

describe("duplicate clusters", () => {
  it("groups three spellings of one idea together, not as three pairs", () => {
    const tags = [
      tag({ id: "a", title: "Beginner" }),
      tag({ id: "b", title: "beginners" }),
      tag({ id: "c", title: "Beginner" }),
      tag({ id: "d", title: "Advanced" }),
    ];

    const groups = findDuplicateGroups(tags);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tags.map((entry) => entry.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("names why the titles collapsed, from the titles themselves", () => {
    expect(
      findDuplicateGroups([tag({ id: "a", title: "Risk" }), tag({ id: "b", title: "risk" })])[0]
        ?.reason,
    ).toBe("Differs only by case");

    expect(
      findDuplicateGroups([
        tag({ id: "a", title: "Risk management" }),
        tag({ id: "b", title: "risk-management" }),
      ])[0]?.reason,
    ).toBe("Differs only by spacing or punctuation");

    expect(
      findDuplicateGroups([tag({ id: "a", title: "Rule" }), tag({ id: "b", title: "Rules" })])[0]
        ?.reason,
    ).toBe("Differs only by pluralisation");
  });

  it("returns nothing when the vocabulary is clean", () => {
    expect(
      findDuplicateGroups([tag({ id: "a", title: "Alpha" }), tag({ id: "b", title: "Beta" })]),
    ).toEqual([]);
  });

  it("orders the largest cluster first", () => {
    const groups = findDuplicateGroups([
      tag({ id: "a", title: "Rule" }),
      tag({ id: "b", title: "Rules" }),
      tag({ id: "c", title: "Risk" }),
      tag({ id: "d", title: "risk" }),
      tag({ id: "e", title: "RISK" }),
    ]);
    expect(groups[0]?.tags).toHaveLength(3);
  });
});

describe("survivor suggestion", () => {
  it("defaults to the most-attached tag", () => {
    // Re-pointing the smaller side is the cheaper mistake if the operator
    // confirms without reading.
    const chosen = suggestSurvivor([
      tag({ id: "a", title: "Beginner", usage: { courses: 1, lessons: 0 } }),
      tag({ id: "b", title: "Beginners", usage: { courses: 4, lessons: 2 } }),
    ]);
    expect(chosen?.id).toBe("b");
  });

  it("breaks ties on the name so the default does not move between renders", () => {
    const chosen = suggestSurvivor([
      tag({ id: "a", title: "Zulu", usage: { courses: 1, lessons: 0 } }),
      tag({ id: "b", title: "Alpha", usage: { courses: 1, lessons: 0 } }),
    ]);
    expect(chosen?.id).toBe("b");
  });

  it("returns null for an empty selection rather than throwing", () => {
    expect(suggestSurvivor([])).toBeNull();
  });
});
