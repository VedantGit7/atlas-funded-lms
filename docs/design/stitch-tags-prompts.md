# Google Stitch Prompts — Tags (`/admin/manage/tags`)

Paste **Block 0 (Design System)** first, then **Block 0-TG (Tags addendum)**, then one screen
prompt per generation.

Block 0 is the **admin** design system, identical to the one in the report-module files.
Reproduced below so this file stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/manage/ManageTagsPanel.tsx`
- `backend/apps/api/src/server/tags/tag-schemas.ts` (the real enums and limits)
- `backend/apps/api/src/app/api/v1/tags/route.ts` and `tags/[id]/route.ts`
- `backend/apps/api/src/app/api/v1/courses/[id]/tags/route.ts`,
  `backend/apps/api/src/app/api/v1/lessons/[id]/tags/route.ts`
- `frontend/apps/web/src/features/admin/manage/admin-manage-catalog.ts`

**Two things to know before designing — and one of them is a live bug.**

First, the real visibility enum is three **lowercase** values: `public`, `private`,
`classification`. The shipped panel hardcodes `VISIBILITIES = ["PUBLIC", "PRIVATE"]` — uppercase,
and missing `classification` entirely. Uppercase values will not pass the server's enum, and a
tag classified as `classification` cannot be edited without silently changing its visibility.
These prompts design against the **schema**, not the panel, and the gaps table calls the mismatch
out.

Second, the panel's own docstring explains why this screen exists: `GET`, `PUT` and `DELETE` on
`/api/v1/tags/[id]` "had no caller anywhere — so a typo in a tag name was permanent and a tag
created by mistake could never be removed." It also states the stake plainly: "Renaming here
changes the tag everywhere it is attached." That sentence is the design brief.

---

## Block 0 — Design System (paste once, first)

```text
DESIGN SYSTEM — Atlas Funded LMS, Admin Console

Product: a multi-tenant learning-management admin console. Tone: calm operator instrument.
Trustworthy, dense, factual. Never playful.

ATMOSPHERE
Density 7 (operator console, information-dense but never cramped). Variance 4 (structured,
left-aligned, asymmetric column weights). Motion 3 (restrained: state changes, skeleton
shimmer, row hover; nothing cinematic). A well-lit control room, not a marketing dashboard.

COLOR PALETTE (light theme / dark theme)
- Page Canvas        #F5F5FB / #0F0E1A   — app background behind all panels
- Panel Surface      #FFFFFF / #1E1D2E   — table shells, cards, drawers, modals
- Sunken Surface     #F0F0F7 / #16151F   — table headers, filter bars, inset code blocks
- Raised Surface     #E9E8F4 / #2D2B44   — hovered rows, selected states, chips
- Hairline Border    #E3E2EF / #2A283E   — 1px structural dividers, panel edges
- Outline            #CAC8DA / #464553   — input borders, checkbox strokes
- Primary Ink        #1B1924 / #F7EFEA   — headings, primary table values
- Muted Ink          #565469 / #C8C4D5   — labels, metadata, timestamps, helper text
- Accent Indigo      #6366F1 (both)      — primary buttons, links, focus rings, active tab
- Accent Indigo Deep #4F46E5 (both)      — accent hover/pressed
- Accent Wash        #E0E7FF / #3730A3   — selected-row tint, accent badge fill
- Success            #15803D / #62DF7D   — public, healthy, saved
- Warning            #B45309 / #E6C364   — needs attention, unused, restricted
- Danger             #DC2626 / #FF8A80   — destructive confirm, failed
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, slugs, IDs, counts, timestamps: JetBrains Mono.
- Banned: Inter, any serif, any display/script face, all-caps body copy.

COMPONENTS
- Tables are the primary object. Sticky header, 44px rows, zebra-free, 1px Hairline row
  dividers, hover = Raised Surface, selected = Accent Wash with a 2px Accent Indigo left rail.
  Row checkboxes in a 44px leading column. Numeric and date columns right-aligned.
- Buttons: flat fills, 8px radius, no glow, no gradient. Primary = Accent Indigo on white ink.
  Secondary = transparent with Outline border. Destructive = Danger text on transparent with
  Danger border; only the final confirm inside a modal gets a solid Danger fill. Active state
  translates down 1px. Minimum 44px tap target.
- Status pills: 6px radius, 11px monospace uppercase, background tinted ~12% of the status
  hue, solid text in the full hue, 1px border. Never a bare colored dot alone.
- Filter bar: a Sunken Surface strip above the table — label above each control, controls on
  one row, wrapping below 1024px. Applied filters render as removable chips beneath, with a
  "Clear all" text button.
- Panels/cards: 12px radius, 1px Hairline border, no drop shadow except overlays (drawer and
  modal get a soft, background-tinted shadow, never black).
- Drawers slide from the right at 560px wide, full-width below 768px, persistent header
  (title + close) and a sticky footer holding the actions.
- Loading = skeleton rows matching exact column widths. Never a circular spinner.
- Empty state = a small line-art mark, one sentence of explanation, one action button.
- Error state = an inline Danger-tinted strip at the top of the panel with a Retry button.
  Toasts are for completed mutations only, never for load failures.
- Every destructive action opens a confirmation that names the exact objects affected and
  states the consequence in plain words.

LAYOUT
Persistent admin left sidebar (240px, collapsible to a 64px icon rail) and a top bar with
breadcrumb, global search, theme toggle, admin avatar. Content max-width 1440px, 32px gutters.
Asymmetric splits where master/detail applies — never 50/50. Everything collapses to a single
column below 768px, and tables become stacked label/value cards. No horizontal page scroll;
wide tables scroll inside their own container with the first column pinned.

MOTION
150–200ms ease-out for hover and state changes. Drawer slides in at 240ms with spring
(stiffness 100, damping 20). Freshly loaded table rows fade+rise with a 20ms stagger capped at
12 rows. Animate transform and opacity only. Respect prefers-reduced-motion.

BANNED
No emojis. No Inter. No serif. No pure black. No neon glow or gradient buttons. No purple
hero gradients. No three-equal-cards KPI row. No generic placeholder names (John Doe, Acme).
No round fake numbers (50%, 99.99%). No marketing copy ("Elevate", "Seamless", "Unleash").
No scroll-cue arrows. No custom cursors. No overlapping elements.
```

---

## Block 0-TG — Tags addendum (paste second)

```text
TAGS MODULE ADDENDUM — applies to every screen under /admin/manage/tags

WHAT THIS MODULE IS
Tenant-wide administration of the tag vocabulary used across courses and lessons. Tags can be
created and attached from the lesson and course editors; this is the only place they can be
renamed, re-scoped, or removed. It is a small screen with a large blast radius.

RENAMING IS GLOBAL — THE COPY MUST NEVER LET AN ADMIN FORGET IT
A tag is one shared record. Renaming it changes it on every course and lesson it is attached to,
instantly, with no per-attachment override. Deleting it removes it from every one of them. So:
  - a permanent one-line note sits beneath the page header on every screen in this module:
    "Tags are shared. Renaming or deleting one changes it everywhere it is attached."
  - the save confirmation on an edit names the old and new title explicitly, in the form
    "Rename “Risk management” to “Risk control” everywhere it is attached?";
  - the delete confirmation states the removal in the same breath as the scope: "It is removed
    from every course and lesson it is attached to."
Never soften either sentence, and never bury them in a tooltip.

THE VISIBILITY ENUM IS THREE LOWERCASE VALUES — USE ALL THREE
public · private · classification.
Render them sentence-case as pills: Public in Success, Private in Muted, Classification in
Warning. The stored values are lowercase; display-case them but never send a different case
back. Never show a two-option toggle, because a third value exists and a tag holding it must be
editable without being silently converted.
"Classification" is the odd one and needs a caption wherever it is selectable: it marks a tag
used to categorise rather than to label — treat it as a structural tag, not a descriptive one.
Where the meaning is genuinely tenant-defined, say that in the caption rather than inventing a
definition.

EVERY TAG HAS A SLUG AND THE SHIPPED PANEL HIDES IT — SHOW IT
The record carries id, title, slug, description, and visibility. The slug is what appears in
URLs and filters, so render the title as the primary label with the slug beneath it in 11px
monospace and a copy icon. A design that omits the slug makes two similarly titled tags
indistinguishable.

FIELD LIMITS ARE REAL — SURFACE THEM
Title: required, trimmed, 1 to 60 characters. Description: optional, trimmed, up to 255
characters. Show a live character counter on both, turning Warning within 10 characters of the
limit, and never allow a silent truncation. An empty description is a legitimate state and
renders as "No description" in Muted Ink, never as an empty row.

THE LIST IS NOT PAGINATED — DO NOT DRAW A PAGINATOR
The list endpoint returns a bare items array: no cursor, no page, no total count. So the screen
shows every tag at once. That means:
  - no page numbers, no "Showing 1–25 of N", no "Load more";
  - a client-side search and filter instead, with a live "N of M tags" caption above the list;
  - a design that stays legible at 200 tags — a dense list, sticky header, and alphabetical
    grouping rather than a wall of equal rows.
If the vocabulary grows past what one screen can hold, that is a backend change, not a design
workaround.

THERE IS NO REVERSE LOOKUP — SAY SO WHERE IT MATTERS
The API can list the tags on a given course or lesson, but it cannot list the courses or lessons
carrying a given tag. So there is no usage count and no "used by" list anywhere in this module.
Wherever a design wants one — and the delete confirmation is exactly where an admin most wants
one — state the absence plainly rather than showing a fabricated number: "This console cannot
yet show where a tag is attached." Never render "0 uses" for a tag that may be attached to
dozens of lessons.

EDITING RE-READS BEFORE IT OPENS
The shipped panel fetches the single tag before populating the edit form, so an edit always
starts from current values rather than a stale row. Preserve that: the edit affordance shows a
brief inline busy state on the row it was pressed from, not a full-page spinner, and a failed
fetch shows an inline error on that row rather than opening an empty form.

TAGS ATTACH TO COURSES AND LESSONS, AND NOTHING ELSE
The only attachment endpoints are course tags and lesson tags, each replacing the whole set with
up to 100 tag ids. Never imply a tag can be attached to a product, a batch, a learner, or a
resource.

DATA REALISM
Tag titles like "Risk management", "Position sizing", "Beginner", "Prop firm rules",
"Needs review", "Live session". Slugs in monospace kebab-case: "risk-management",
"position-sizing". Descriptions of one short sentence. A realistic vocabulary is 30 to 80 tags
with a long tail of near-duplicates — "Beginner" and "beginners" both existing is the exact mess
this screen is for.
```

---

## Screen 1 — `/admin/manage/tags` (the vocabulary)

```text
Screen: Tags. Route /admin/manage/tags. Desktop 1440px, admin sidebar with "Manage" expanded and
"Tags" active.

HEADER
Breadcrumb: Admin / Manage / Tags. Title "Tags", subtitle "Rename, re-scope or remove the tags
used across courses and lessons." Right side: a secondary "Refresh" button and a primary "New
tag" button.

MANAGE SECTION TAB STRIP — the Manage area's own nav, horizontally scrollable: Course Encryption
· Discussions · Ratings and Reviews · Answer reviews · Learner Support · Archive Learners ·
Course Backup · Learner Products · Tags, with "Tags" active in Accent Indigo.

SHARED-TAG NOTE — a slim Sunken Surface strip directly beneath the page header, one line in Muted
Ink: "Tags are shared. Renaming or deleting one changes it everywhere it is attached." Not
dismissible.

CONTROLS ROW — a Sunken Surface strip holding, on one line:
  - a search input with the placeholder "Search title, slug or description", filtering live as
    the admin types, with a clear x;
  - a "Visibility" segmented control with four options — All · Public · Private · Classification
    — matching the real three-value enum plus All;
  - a "Sort" select (A–Z, Z–A, Recently updated, Recently created);
  - a "Group alphabetically" toggle, on by default.
Beneath the strip, a live count caption in Muted Ink: "42 of 68 tags" when filtered, "68 tags"
when not. No paginator anywhere on this screen — state that in a Muted Ink caption at the foot
of the list instead: "All tags are shown. This list is not paginated."

THE LIST — the primary object, a dense list rather than a heavy table, because a tag has only
four fields worth showing:
With alphabetical grouping on, a small sticky letter header — "A", "B", "C" — sits above each
group in 12px/600 Muted Ink with a hairline beneath and a count beside it.
Each tag is one row, 56px tall, laid out as:
  - [checkbox] at the leading edge;
  - the title at 14px/500 in Primary Ink, with the slug beneath in 11px monospace Muted Ink and a
    copy icon that appears on hover;
  - the description in the middle column at 13px in Muted Ink, truncated to one line, or "No
    description" in Muted Ink where null;
  - a visibility pill (Public in Success, Private in Muted, Classification in Warning);
  - a trailing action group: an "Edit" secondary button and a "Delete" destructive-outline
    button, both 44px tall.
Rows separate with a 1px Hairline and take a Raised Surface on hover. Show 14 rows spanning all
three visibility values, including two near-duplicate titles ("Beginner" and "Beginners") sitting
adjacent under the same letter group so the deduplication problem is visible, and two rows with
no description.

SELECTION BAR (render visible): "4 tags selected" with "Change visibility", "Delete", "Clear" —
and a Muted Ink caption inside the bar reading "Bulk actions apply everywhere these tags are
attached."

EDIT PANEL — produce as a second frame: pressing Edit on a row opens an inline edit panel
directly beneath that row, expanding the list rather than covering it, so the admin keeps their
place. The panel holds: a "Title" input pre-filled, with a live character counter reading "18 /
60"; a "Description" textarea with "94 / 255"; a "Visibility" segmented control with all three
real values and a Muted Ink caption under Classification reading "Marks a structural tag used to
categorise rather than describe"; the slug shown as a read-only monospace value with a copy icon
and a caption "Slug is derived and cannot be edited here"; and a footer with a primary "Save
changes" and a secondary "Cancel". While the panel is fetching current values, the row it opened
from shows a small inline busy state and the panel renders as three skeleton fields.

SAVE CONFIRMATION MODAL — title "Rename this tag everywhere?", body naming the change in full:
"“Risk management” becomes “Risk control” on every course and lesson it is attached to." A Muted
Ink line beneath adds: "This console cannot yet show where a tag is attached." Then Cancel and a
primary "Rename tag". Produce a busy variant.

DELETE CONFIRMATION MODAL — title "Delete tag?", body: "Delete “Needs review”? It is removed from
every course and lesson it is attached to." The same Muted Ink line about the missing usage view.
Then a "Keep tag" secondary and a solid Danger "Delete tag". Produce a busy variant.

ALSO PRODUCE as separate frames:
A. Loading — the header, note, and controls row live, and eight skeleton rows matching the real
   row shape: a title bar, a shorter slug bar, a description bar, and a pill-shaped block.
B. Empty vocabulary — a line-art mark of a blank label, heading "No tags yet", the sentence "Tags
   are created here or from a course or lesson editor.", and a primary "New tag".
C. Empty search — "No tags match “onboarding”" with a "Clear search" button, the controls row
   retained and the count caption reading "0 of 68 tags".
D. Error — an inline Danger strip reading "Could not load tags." with a Retry button, replacing
   the list.
E. Save failure — the edit panel still open with an inline Danger strip inside it reading "Could
   not save the tag." and the entered values preserved.
F. Grouping off — the same list sorted by Recently updated with no letter headers, proving the
   list reads well both ways.
G. Mobile 390px — the controls row collapses to a search field plus a "Filters" button opening a
   bottom sheet; each tag becomes a card with title, slug, visibility pill, description, and a
   two-button action row; the edit panel becomes a full-screen sheet.
```

---

## Screen 2 — `/admin/manage/tags/new`

> **Shipped 2026-08-24** as the standalone page only, at
> `frontend/apps/web/src/features/admin/tags/AdminTagNewPage.tsx`. The prompt asks for a drawer
> _and_ a page; shipping both would be two implementations of one four-field form, and the page
> is the variant that deep-links, so the drawer was dropped rather than duplicated. The duplicate
> guard is built as specified — a warning that never blocks — with one addition the prompt does
> not cover: an **exact** slug clash blocks, because the unique index on `(tenant_id, slug)`
> rejects it regardless.

```text
Screen: New tag. Route /admin/manage/tags/new. A compact focused form — this is a four-field
record, so it must not be dressed up as a wizard. Produce it as a right-side drawer over the
list, and also as a standalone page for deep links.

HEADER
Drawer header: "New tag" with a close x. Page variant: breadcrumb Admin / Manage / Tags / New
tag, title "New tag", subtitle "Tags are shared across every course and lesson."

FORM — a single column, four controls, generously spaced:
  - "Title" text input, required, autofocused, with a live counter "0 / 60" and helper text
    "Shown wherever the tag appears."
  - "Slug" — a read-only derived preview in monospace beneath the title field, updating live as
    the title is typed ("risk-management"), with a Muted Ink caption "Generated from the title."
    Never an editable field, because the create body has no slug.
  - "Description" textarea, optional, counter "0 / 255", helper "One short sentence. Optional."
  - "Visibility" segmented control with all three real values — Public · Private · Classification
    — defaulting to Public, each with a one-line caption beneath the control that changes with
    the selection: "Visible wherever tags are shown", "Hidden from learner-facing surfaces",
    "Marks a structural tag used to categorise rather than describe".

DUPLICATE GUARD — a live inline notice, and the most useful thing on this screen: as the title is
typed, any existing tag whose title matches case-insensitively or differs only by pluralisation
renders in a Warning-tinted strip beneath the title field — "A tag called “Beginners” already
exists" — with the existing tag's slug in monospace, a chevron to open it, and a caption "Tags
are shared, so a near-duplicate splits the same idea across two labels." The strip never blocks
submission; it informs.

FOOTER — a sticky footer with Cancel and a primary "Create tag", the primary disabled until the
title is non-empty.

ALSO PRODUCE: the success state — the drawer closing with a toast reading "Tag created" and the
new row highlighted in Accent Wash at its alphabetical position in the list behind; a validation
state where the title is empty and the field shows a Danger caption "A title is required"; a
duplicate-guard state with the Warning strip visible; a create-failure state with an inline
Danger strip inside the drawer preserving the entered values; and a 390px mobile frame where the
drawer is a full-screen sheet with the footer pinned.
```

---

## Screen 3 — `/admin/manage/tags/[tagId]`

> **Shipped 2026-08-24** at `frontend/apps/web/src/features/admin/tags/AdminTagDetailPage.tsx`,
> with one section of the prompt below deliberately **not** built. The "Usage not available"
> panel — heading, the sentence about no reverse lookup, and the "A reverse lookup endpoint would
> fill this panel" line — describes a limitation that no longer exists. `GET /api/v1/tags/[id]/usage`
> ships the real counts and lists, so the panel shows them. "Similar tags" is built as specified
> and gained a Merge action, because flagging a near-duplicate with no way to resolve it is a
> dead end. A third panel, "Recent activity", was added on the back of a new `targetId` filter on
> the audit endpoint.

```text
Screen: Tag detail. Route /admin/manage/tags/[tagId]. The single-tag view, reached from a row or
a deep link. It exists mainly to hold the edit form at full size and to be honest about what the
console cannot yet show.

HEADER
Breadcrumb: Admin / Manage / Tags / Risk management. Title: the tag title at 24px/600, with the
slug beneath in monospace with a copy icon, and a visibility pill beside the title. Right:
secondary "Copy tag ID", destructive-outline "Delete tag", primary "Save changes" — disabled
until a field changes, with an unsaved-changes caption in Warning when dirty.

SHARED-TAG NOTE — the same strip as the list screen, carried through.

LAYOUT — asymmetric 62/38.

LEFT — the edit form as the primary object, larger and calmer than the inline panel on the list:
"Title" with its 60-character counter; "Description" with its 255-character counter; "Visibility"
as a three-option segmented control with the per-option caption; and beneath them a read-only
metadata block of label/value rows — Slug (monospace with copy), Tag ID (monospace 8-character
fragment with copy), Created (relative + absolute), Updated (relative + absolute).

RIGHT — two stacked panels:
1. "Where this tag is used" — the honest one. A Sunken Surface panel with a small line-art mark
   of a link with a question mark, the heading "Usage not available", one plain sentence: "This
   console can list the tags on a course or lesson, but cannot yet list the courses and lessons
   carrying a tag." Then two chevron links that do work — "Browse courses" and "Browse lessons" —
   and a closing Muted Ink line naming what would be needed: "A reverse lookup endpoint would
   fill this panel." No count, no zero, no greyed table.
2. "Similar tags" — a client-side helper that needs no backend: any other tag whose title is a
   case-insensitive or plural variant, listed as rows with title, slug in monospace, visibility
   pill, and a chevron. A caption reads "Near-duplicates split the same idea across two labels."
   An empty variant reads "No similar tags found."

ALSO PRODUCE: loading skeleton for both columns; the save-confirmation modal from Screen 1 reused
verbatim; the delete-confirmation modal reused verbatim, with a Muted Ink line added beneath it
noting that deletion cannot be undone and the tag would need recreating by hand; a not-found
state where the tag id does not resolve, showing a centred panel with "That tag no longer exists"
and a primary "Back to tags"; and a 390px mobile frame where the right column stacks beneath the
form.
```

---

## Screen 4 — `/admin/manage/tags/merge`

> **Shipped 2026-08-24** at `frontend/apps/web/src/features/admin/tags/AdminTagMergePage.tsx`.
> The capability strip this prompt leads with — "merging is not available yet" — is obsolete:
> `POST /api/v1/tags/merge` moves attachments and deletes the sources in one transaction. The
> "for when merging exists" reference layout **is** the shipped screen. One change on top of it:
> the endpoint takes `sourceTagIds` as a list, because a duplicate cluster is usually three
> spellings rather than a pair, and looping pairwise calls would leave a half-merged vocabulary
> behind the first failure. The duplicate finder groups clusters and labels why each collapsed.

```text
Screen: Merge tags. Route /admin/manage/tags/merge. The screen the near-duplicate problem
demands — and one that depends on an endpoint that does not exist yet, so it must say so on its
face rather than pretending to work.

HEADER
Breadcrumb: Admin / Manage / Tags / Merge. Title "Merge tags", subtitle "Fold duplicate tags into
one without losing where they are attached." Right: secondary "Back to tags".

CAPABILITY STRIP — directly beneath the header, before any control, a Warning-tinted strip two
lines tall: "Merging is not available yet. The API can create, rename and delete a tag, but it
cannot move attachments from one tag to another." A Muted Ink second line names the manual path
that does work today: "Until then, retag the affected courses and lessons from their own editors,
then delete the spare tag." Not dismissible.

BODY — the unavailable state, and this is the primary frame: a Panel Surface block filling the
content area with a small line-art mark of two labels converging, the heading "Merge not
available", the explanatory sentence, and two buttons — a secondary "Back to tags" and a
secondary "Browse courses". No form, no fake preview.

DUPLICATE FINDER — this part needs no backend and should ship regardless, so render it beneath
the unavailable block as a working panel headed "Possible duplicates": a client-side scan of the
tag list grouping titles that match case-insensitively, differ only by pluralisation, or differ
only by punctuation and spacing. Each group is a Panel Surface block listing its members as rows
with title, slug in monospace, visibility pill, and a chevron, plus a caption naming why they were
grouped ("Differs only by plural"). A footer line reads "6 possible duplicate groups across 68
tags". An empty variant reads "No obvious duplicates found."

THE READY DESIGN — produce as a clearly labelled second frame headed "For when merging exists",
so the shape is ready without shipping a lie:
a two-column picker where the left column selects the tags to merge (multi-select from the list
with search) and the right column selects the survivor, with the survivor's title, slug, and
visibility shown in full; beneath, a preview strip stating the effect in plain words — "3 tags
fold into “Beginner”. Every course and lesson attached to the other two gains “Beginner” and
loses the tag it had." A Warning line notes that the merged tags are deleted and cannot be
recovered. Then a footer with Cancel and a solid Danger "Merge 3 tags into “Beginner”".
Beneath that frame, a Muted Ink note listing exactly what the ready design needs from the
backend: a merge endpoint that reassigns attachments and deletes the source tags in one
transaction, and ideally the reverse lookup so the preview can state real counts.

ALSO PRODUCE: a loading skeleton for the duplicate finder only; and a 390px mobile frame of the
unavailable state with the duplicate finder stacked beneath.
```

---

## Backend gaps these prompts assume

| Prompt feature                                                            | Status                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List all tags, optionally filtered by `visibility` or `publicOnly`        | exists                                                                                                                                                                                                                                                       |
| Create a tag (title 1–60, optional description ≤255, optional visibility) | exists                                                                                                                                                                                                                                                       |
| Read, update, and delete a single tag                                     | exist — and until this panel shipped, they had **no caller at all**                                                                                                                                                                                          |
| Visibility enum `public` / `private` / `classification`                   | exists                                                                                                                                                                                                                                                       |
| Slug on every tag record                                                  | exists — **but the shipped panel never displays it**                                                                                                                                                                                                         |
| Replace the tags on a course or a lesson (up to 100 ids)                  | exist                                                                                                                                                                                                                                                        |
| **Reverse lookup: which courses and lessons carry a given tag**           | **built** (2026-08-24) — `GET /api/v1/tags/[id]/usage` returns exact counts plus the first 25 courses and lessons. Both join tables already indexed `(tenant_id, tag_id)`; the query simply had no caller                                                    |
| Usage count per tag                                                       | **built** — `GET /api/v1/tags?withUsage=true` attaches `{courses, lessons}` to each item, opt-in so the lesson and course tag pickers do not pay for two aggregates they never render                                                                        |
| **Merge two or more tags**                                                | **built** — `POST /api/v1/tags/merge` re-points the source's attachments onto the target and soft-deletes the source. Insert-then-delete with `on conflict do nothing`, because on a merge of near-duplicates a course carrying both tags is the common case |
| Pagination on the tag list                                                | missing by design — the endpoint returns a bare items array, which is why no paginator is drawn                                                                                                                                                              |
| Server-side duplicate or near-duplicate detection                         | missing — the create-screen guard and the duplicate finder are both client-side over the full list, which is only viable because the list is unpaginated                                                                                                     |
| Bulk visibility change, bulk delete                                       | **built** — `POST /api/v1/tags/bulk` with `set_visibility` or `delete`, returning `updatedIds` and `missingIds` so a stale selection does not fail the batch                                                                                                 |

**One live bug, fixed 2026-08-24.** `ManageTagsPanel.tsx` declares
`VISIBILITIES = ["PUBLIC", "PRIVATE"]` while `tagVisibilitySchema` is
`z.enum(["public", "private", "classification"])`. Three consequences: the panel sends uppercase
values the server enum will reject; it cannot express `classification` at all; and it renders
`tag.visibility.toLowerCase()` on read, which only makes sense if it expected uppercase back.
Any tag stored as `classification` could not be edited through that panel without being silently
reassigned. `ManageTagsPanel.tsx` has been replaced by
`frontend/apps/web/src/features/admin/tags/AdminTagsPage.tsx`, which offers all three lowercase
values.

**Where the copy in this file is now out of date.** Block 0-TG says "there is no reverse lookup"
and instructs every screen to state the absence — "This console cannot yet show where a tag is
attached." That sentence is no longer true and must not be reproduced: the delete confirmation
names the live attachment count, and a "Used by" column opens the list. Screen 4's merge
capability strip is likewise obsolete; merging works.
