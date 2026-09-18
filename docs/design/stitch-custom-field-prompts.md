# Google Stitch Prompts — Custom Field (`/admin/reports/custom-field`)

Paste **Block 0 (Design System)** first, then **Block 0-CF (Custom Field addendum)**, then one
screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the Active Devices, Payments, Progress & Score, Batches,
Polls, and Sales & Marketing files; reproduced here so this file stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminCustomFieldRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-custom-field-roster-api.ts`
- `backend/packages/domain/src/custom-fields/custom-fields.dto.ts` (field types)
- Definitions are authored at `/admin/custom-fields` — this module only reports on them

Today the module is a single learner roster whose columns are partly dynamic: seven fixed
columns plus one column per active custom-field definition returned as `fieldDefinitions`.
Filters are an ad-hoc field/value row builder. Actions: export, message, create group.

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
- Success            #15803D / #62DF7D   — complete, active, healthy
- Warning            #B45309 / #E6C364   — missing data, stale, needs attention
- Danger             #DC2626 / #FF8A80   — invalid, suspended, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, field keys, counts, IDs, timestamps: JetBrains Mono.
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
- Every action that messages learners or changes their records opens a confirmation that names
  the exact count and states the consequence in plain words.

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

## Block 0-CF — Custom Field addendum (paste second)

```text
CUSTOM FIELD MODULE ADDENDUM — applies to every screen in /admin/reports/custom-field

WHAT THIS MODULE IS
A tenant defines its own learner attributes — "Trading experience", "Preferred market",
"Referred by", "Funded account size", "Onboarding call booked". This report shows learners
against those attributes, and lets an admin slice, group, message, and export by them. The
definitions themselves are authored elsewhere (Admin → Custom fields); this module reports on
them and links out to manage them. Never present this as a field editor.

THE COLUMN SET IS NOT FIXED — DESIGN FOR THAT
Every table here has seven known columns (Learner, Email, Enrolments, Total spent, Last active
on, Signed up on, Status) plus one column per active custom-field definition, and the tenant
may have three fields or thirty. So:
  - The known columns are pinned to the left; custom-field columns follow, in definition order,
    each with its field key in 10px monospace Muted Ink beneath the label so two similarly
    named fields are still distinguishable.
  - Custom-field column headers carry a small field-type marker — a bare 10px monospace letter
    or short word (txt, num, bool, sel, date) in Muted Ink, never an icon glyph.
  - The table scrolls horizontally inside its own container with the Learner column pinned.
  - The columns popover groups checkboxes under two headings, "Learner columns" and "Custom
    fields", with a search input above the custom-field group and a "Select none" for it.
  - Always draw at least eight custom-field columns in mockups so the horizontal-scroll and
    pinning behaviour is actually proven, not assumed.

FIELD TYPES (real enum — exactly these five)
text · number · boolean · select · date
Render values by type, never as raw strings:
  - text — plain, truncated to one line with a tooltip on overflow
  - number — monospace, right-aligned
  - boolean — a small "Yes" / "No" pill (Success / Muted), never a checkbox glyph
  - select — a chip carrying the option label; the chip fill is Raised Surface for every
    option, since option values carry no inherent good/bad meaning and must not be colour-coded
  - date — monospace absolute date with a relative caption beneath where recent
A field with no value for a learner renders as an em dash in Muted Ink with no tooltip — an
absent value is normal, not an error, and must never be styled as Warning inside a table row.

COVERAGE IS A FIRST-CLASS METRIC
For any field, "coverage" is the share of learners with a non-empty value. Show it as a
percentage in monospace with a 3px bar and the raw fraction beneath: "68%" / bar / "2,320 of
3,412 learners". Coverage below 40% carries a Warning tint at the field level (headers, field
catalogue, field detail) — but never on individual learner rows.

SEGMENTS
A segment is a saved set of conditions over these fields plus the known learner columns. A
condition reads field → operator → value, with operators drawn from the field's type: text
(is, is not, contains, starts with, is empty, is not empty), number (=, ≠, >, <, between, is
empty), boolean (is true, is false, is empty), select (is any of, is none of, is empty), date
(before, after, between, in the last N days, is empty). Conditions combine with AND/OR groups.
Every segment surface must show a live matched count and a "View matched learners" link.

COHORT ACTIONS
Matched learners can become a saved group or receive a message, exactly as in the other report
modules. Both sit behind one "Cohort actions" secondary button that opens a drawer, and both
restate the matched count before committing.

DATA REALISM
Field labels like "Trading experience", "Preferred market", "Funded account size", "Referred
by", "Onboarding call booked", "Risk tolerance", "Time zone", "Broker". Field keys in
monospace snake_case: trading_experience, preferred_market, funded_account_size.
Select options like "Under 1 year", "1–3 years", "3–5 years", "Over 5 years"; "Forex",
"Indices", "Crypto", "Commodities". Learner names like "Priya Raghunathan", "Tomás Beltrán",
"Ade Okonjo", "Wei-Lin Chua". Amounts like 12,499.00 INR. Counts like 47, 218, 3,412.
Percentages like 68%, 41.3%, 6.4%.
```

---

## Screen 1 — `/admin/reports/custom-field` (learner roster)

```text
Screen: Custom Field — learner roster. Route /admin/reports/custom-field. Desktop 1440px, admin
sidebar with "Reports" expanded and "Custom Field" active.

HEADER
Breadcrumb: Admin / Reports / Custom Field. Title "Custom Field", subtitle "Every learner
against the attributes your tenant defines — slice, group, message, or export by any of them."
Right side: secondary "Columns", secondary "Export CSV", secondary "Manage fields" linking to
Admin → Custom fields, and a primary "Cohort actions" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Learners · Fields · Segments · Cohorts · Exports. Underline tabs, active in Accent Indigo.

SIGNAL BAND (unequal cells, first is double width)
"Learners" — 3,412 in 32px monospace with the caption "2,986 active · 426 inactive" and a thin
Accent Indigo bar strip behind the lower third showing signups per week. Then: "Custom fields
11" with the caption "9 active · 2 archived" | "Average coverage 68%" with a 3px bar |
"Learners with every field filled 1,204" with the caption "35.3%" | "Fields below 40% coverage
3" in Warning, clickable through to the field catalogue.

FILTER BAR
A Sunken Surface strip: a search input ("Search learner name or email"), an email input, a
"Status" select (Active, Inactive, Invited, Suspended, All), "Signed up from" and "Signed up
to" date pickers, "Total spent between" dual money inputs, "Last active" select (Any, Last 7
days, Last 30 days, No activity in 90 days), and an "Add field condition" ghost button.
Pressing it appends a condition row rendered as three inline controls — a field combobox
grouped under "Learner columns" and "Custom fields" with a search, an operator select whose
options change with the chosen field's type, and a value control that also changes with the
type (free text, number input, a Yes/No segmented control, an option multi-select, or a date
picker / relative-days input). Each row has a remove button; a small "Match all / Match any"
segmented control sits above the condition list once two or more exist.
Applied filters render as removable chips beneath the strip, custom-field conditions written in
full — "Trading experience is any of 3–5 years, Over 5 years" — with "Clear all", "Save as
segment", and a live "Matches 418 learners" caption aligned right.
Saved-view tabs above the table: "All learners" (active), "Missing key fields", "Experienced
traders", "Onboarding incomplete", "+ New view".

COLUMNS POPOVER — produce one frame with it open: two grouped checkbox lists as described in
the addendum, the custom-field group with its own search input, drag handles for reordering,
"Reset to default", and Apply. Show the group scrolled with at least twelve custom fields.

TABLE
Pinned left: [checkbox] | Learner (avatar chip + name over email in Muted Ink, name links to
the member profile). Then the known columns: Enrolments (monospace) | Total spent (monospace
right-aligned with the currency code suffix) | Last active on (relative + absolute) | Signed up
on | Status pill. Then at least eight custom-field columns showing every field type — a text
field, two selects, a boolean, a number, a date, and two more selects — each header carrying
the label, the key in 10px monospace beneath, and the type marker. Populate values per the
addendum's type rules, and leave several cells as em dashes so the missing-value treatment is
visible. The trailing column is a kebab (Open member profile, View custom fields, Edit field
values, Message learner, Copy membership ID).
Sortable headers on Total spent, Last active on, Signed up on, Learner; active sort = Signed up
on descending. Show 12 rows.

SELECTION BAR (render visible): "14 learners selected" with "Create group", "Message
learners", "Export selection", "Clear".

FOOTER: "Showing 1–25 of 3,412 learners", page-size select, paginator, and a Muted Ink caption:
"Custom-field columns come from your tenant's active field definitions."

ALSO PRODUCE as separate frames:
A. Loading — skeleton signal band and skeleton rows matching exact column widths, including
   the horizontally scrolled custom-field region.
B. Empty — line-art mark of a form with labelled rows, heading "No learners match these
   filters", one sentence, primary "Clear filters".
C. No fields defined — a distinct empty state for a tenant with zero custom fields: the table
   is replaced by a panel reading "No custom fields are defined yet", the sentence "Define
   attributes like trading experience or preferred market to slice your learners by them.",
   and a primary "Manage fields".
D. Error — inline Danger strip "Couldn't load the learner roster." with Retry.
E. Mobile 390px — signal band as a two-up grid; the filter bar collapses to a search field plus
   a "Filters (3)" button opening a bottom sheet; each learner becomes a card showing name,
   email, status, and the first three custom fields as label/value rows with a "Show all 11
   fields" text toggle.
```

---

## Screen 2 — `/admin/reports/custom-field/fields`

```text
Screen: Field catalogue. Route /admin/reports/custom-field/fields. Module tab active on
"Fields". This is the health view for the tenant's own attribute schema.

HEADER
Title "Fields", subtitle "Every custom field, how well it is filled in, and what values it
holds." Right: secondary "Export CSV", primary "Manage fields" linking to Admin → Custom
fields.

SUMMARY BAND (unequal cells): "Fields defined 11" at 32px monospace with the caption "9 active
· 2 archived" (double width) | "Average coverage 68%" with a 3px bar | "Fully covered fields 2"
in Success with the caption "every learner has a value" | "Below 40% coverage 3" in Warning,
clickable to filter | "Never used 1" in Warning with the caption "no learner has a value".

COVERAGE OVERVIEW — a full-width panel above the table: one horizontal row per field, ordered
by coverage ascending so the weakest lead. Each row shows the field label, the key in 10px
monospace, the type marker, a bar filled to the coverage percentage (Accent Indigo, Warning
tint below 40%), the percentage and the fraction in monospace on the right. This is the primary
object of the screen — a plain, honest bar list, not a heatmap or treemap.

FILTER BAR
Search ("Search field label or key"), "Type" multi-select (text, number, boolean, select,
date), "Status" select (Active, Inactive, Archived, All), "Coverage" select (Any, Below 40%,
40–80%, Above 80%, Never used), and a sort select (Coverage ↑, Coverage ↓, Label A–Z, Recently
created).

TABLE — one field per row
Field (label in Accent Indigo over the key in 11px monospace with a copy icon) | Type chip |
Status pill | Coverage (percentage in monospace with a 3px bar and the fraction beneath;
Warning tint below 40%) | Distinct values (monospace count; for select fields, "4 of 4 options
used" with a caption naming any unused option) | Most common value (the value as a chip with
its share in monospace beneath, or "No values recorded" in Muted Ink) | Last updated (the most
recent time any learner's value changed, relative + absolute) | Created on | chevron. Rows
click through to the field detail. Show 11 rows covering all five types, including one archived
field at reduced emphasis with the caption "Archived — values are kept but no longer collected"
and one never-used field with a Warning rail.

FOOTER: count line, page-size select, paginator, and a Muted Ink caption: "Coverage counts a
learner as covered when the field has any non-empty value."

ALSO PRODUCE: loading skeleton; the zero-fields empty state (same copy as the roster's variant
C, with the primary "Manage fields"); inline error strip; and a 390px mobile frame where the
coverage overview stacks with the bar beneath each field label.
```

---

## Screen 3 — `/admin/reports/custom-field/fields/[fieldKey]`

```text
Screen: Field detail. Route /admin/reports/custom-field/fields/[fieldKey]. Back text-link "All
fields". Produce THREE variants of this screen, because the body changes fundamentally with the
field type: a select field, a number field, and a boolean field.

HEADER
Breadcrumb: Admin / Reports / Custom Field / Fields / Trading experience. Title: the field
label, with the key beneath in monospace with a copy icon, and a chip cluster: type, status,
"Created 14 Feb 2026". Right: secondary "Export CSV", secondary "Edit field" linking to Admin →
Custom fields, primary "Cohort actions".

SUMMARY BAND (unequal cells): "Coverage 72%" at 32px monospace with a 3px bar and the caption
"2,456 of 3,412 learners" (double width) | "Distinct values 4" | "Most common 1–3 years" with
its share beneath | "Missing 956" in Warning, clickable through to a filtered roster | "Last
updated 2 days ago".

BODY — VARIANT A, SELECT FIELD (the primary variant):
"Value distribution" — one horizontal bar per option in the field's own option order, each row
showing the option label, a bar proportional to its share, and the count and percentage in
monospace on the right; the leading option in full Accent Indigo, the rest at 60% tint, and any
defined option with zero learners rendered as an empty track with a Muted "0 · 0.0%" and a
caption "Defined but unused". Beneath the bars, a "Values not in the option list" panel listing
any stored value that no longer matches a defined option, each with its count and a Warning
pill "Orphaned value" — an empty variant of this panel reads "All stored values match the
current option list."
Then "Cross-tabulation" — a compact matrix letting an admin see this field against one other:
a "Compare with" combobox above the matrix defaulting to another select field; rows are this
field's options, columns are the other field's options, cells hold the learner count in
monospace with a background tint scaled to the count, plus pinned totals on the trailing row
and column. A caption explains the strongest association in plain words.

BODY — VARIANT B, NUMBER FIELD:
"Value distribution" — a histogram in 10 buckets across the observed range, bars in Accent
Indigo, with the median marked as a vertical dashed line and captions beneath the axis giving
minimum, median, mean, maximum, and standard deviation in monospace. Beside it a small
"Outliers" list showing the five highest and five lowest values with the learner name attached.

BODY — VARIANT C, BOOLEAN FIELD:
"Value distribution" — a single two-segment horizontal band, Yes in Success and No in Muted,
each labelled with count and share, plus a third Outline segment for learners with no value.
Beneath it, "Trend" — a small line chart of the Yes share over the last 12 weeks, with a caption
naming the movement.

SHARED, ALL VARIANTS — beneath the distribution:
"Learners" — a compact table filtered to this field: [checkbox] | Learner (avatar chip + name
over email) | This field's value (rendered by type) | Enrolments | Total spent | Last active on
| Signed up on | kebab. Above it a value filter — for select fields a chip row of options that
also includes a "No value" chip, for number a between control, for boolean a Yes/No/No value
segmented control, for date a range picker. Show 10 rows.

SELECTION BAR: "18 learners selected" with "Create group", "Message learners", "Export
selection", "Clear".

ALSO PRODUCE: loading skeleton; the never-used empty state — "No learner has a value for this
field yet", a sentence naming when it was created, and a secondary "Edit field"; inline error
strip; and a 390px mobile frame where the cross-tabulation is replaced by the caption "Open on
a larger screen to see the cross-tabulation".
```

---

## Screen 4 — `/admin/reports/custom-field/learners/[membershipId]`

```text
Screen: Learner field values. Route /admin/reports/custom-field/learners/[membershipId]. A
right-side drawer over the roster at 560px, AND a standalone full page for deep links. Produce
both.

HEADER
Avatar chip, learner display name, email beneath in Muted Ink monospace, and pills: status,
"11 fields · 8 filled". Right (page version) / sticky footer (drawer version): secondary "Open
member profile", secondary "Message learner", primary "Edit values".

SUMMARY STRIP: "Field completeness 73%" in monospace with a 3px bar and the caption "8 of 11
fields", then "Enrolments 3", "Total spent 24,998.00 INR", "Last active 2 days ago", "Signed up
14 Mar 2026" as hairline-separated cells.

VALUES LIST — the primary object: one row per field definition in definition order, whether or
not it has a value. Each row shows the field label with its key in 10px monospace beneath and
the type marker; the value rendered by type per the addendum; and on the right the "last
updated" timestamp in monospace with the name of whoever set it ("Set by Priya at signup",
"Set by Nandita Rao", "Imported 14 Mar 2026"). Empty fields render the em dash and a Muted
"Never set" caption — a section divider groups filled fields above empty ones, with the empty
group under a hairline header "Not set (3)".

EDIT MODE — produce as a second frame of the same screen: each row's value becomes an inline
control matching its type (text input, number input, Yes/No segmented control, option select,
date picker), each with a small "Clear" text button. A sticky footer appears reading "3 values
changed" with "Discard" and a primary "Save changes"; changed rows carry an Accent Indigo left
rail. A confirmation modal names the learner and lists the exact before-and-after for each
changed field, with the caption "Value history is kept for audit."

VALUE HISTORY — a collapsed panel at the bottom, expanding to a timeline: monospace timestamp,
field label, old value → new value with the arrow, and who made the change. An empty variant
reads "No changes recorded since these values were first set."

ALSO PRODUCE: loading skeleton; the no-values state ("No custom field values are set for this
learner" with a primary "Edit values"); the zero-fields-defined state ("Your tenant has not
defined any custom fields" with a secondary "Manage fields"); and a 390px mobile frame where
the drawer becomes a full-screen sheet and the edit footer pins to the bottom.
```

---

## Screen 5 — `/admin/reports/custom-field/segments`

```text
Screen: Segments. Route /admin/reports/custom-field/segments. Module tab active on "Segments".
A segment is a saved set of conditions over custom fields and learner columns.

HEADER
Title "Segments", subtitle "Saved conditions over your custom fields — reusable for grouping,
messaging, and export." Right: secondary "Export CSV", primary "New segment".

SUMMARY BAND (unequal cells): "Segments 14" at 32px monospace with the caption "9 shared · 5
private" (double width) | "Learners covered 2,864" with the caption "at least one segment" |
"Largest segment Experienced traders · 812" | "Stale 2" in Warning with the caption "not
refreshed in 30 days" | "Used in messages 6".

TABLE — one segment per row
[checkbox] | Segment (name in Accent Indigo over a one-line plain-English rendering of its
conditions in 11px Muted Ink — "Trading experience is any of 3–5 years, Over 5 years AND Total
spent above 10,000.00 INR") | Conditions (a monospace count, "3 conditions in 2 groups") |
Matches (monospace count with a 3px bar scaled against the largest segment, and a delta caption
against the last refresh — "+42 since 12 Jul") | Sync (a pill: "Live" or "Snapshot") |
Visibility (a chip: Shared or Private) | Created by | Last refreshed (relative + absolute;
Warning past 30 days) | kebab (Open segment, Edit conditions, Duplicate, Create group from
segment, Message segment, Export, Delete). Show 8 rows mixing live and snapshot segments.

BUILDER — produce as its own frame, the "New segment" full-page form at 960px centred:
- "Name" text field and an optional description, plus a visibility radio (Shared with admins /
  Private to me).
- "Conditions" — the core control. Condition rows grouped into blocks; each block has its own
  AND/OR segmented control at the top-left and a hairline border; each row is field combobox →
  operator select → value control, exactly as specified in the addendum, with the operator list
  and value control both derived from the chosen field's type. Row-level remove buttons, an
  "Add condition" secondary button inside each block, and an "Add group" ghost button beneath
  all blocks. Between blocks sits a small AND/OR joiner chip on the connecting line.
- A live results rail docked right at 300px on screens above 1200px: "418 learners match" in
  24px monospace, a "View matched learners" link, a short preview list of six matched learners
  with avatar and name, and a caption "Recalculated as you edit". It shows a Warning state when
  a condition is incomplete: "Finish the highlighted condition to see matches."
- "Refresh mode" — radio: "Live — recalculate whenever the segment is used" / "Snapshot — fix
  the current 418 learners".
- Footer: "Cancel" and a primary "Save segment", disabled until a name and at least one complete
  condition exist.

ALSO PRODUCE: loading skeleton; empty state — line-art funnel mark, "No segments yet", the
sentence "Save a set of conditions once and reuse it for groups, messages, and exports.",
primary "New segment"; the delete-confirmation modal naming the segment, its match count, and
anything that depends on it ("Used by 1 scheduled export"); and a 390px mobile frame where the
builder's results rail becomes a sticky bottom bar reading "418 learners match".
```

---

## Screen 6 — `/admin/reports/custom-field/segments/[segmentId]`

```text
Screen: Segment detail. Route /admin/reports/custom-field/segments/[segmentId]. Back text-link
"All segments".

HEADER
Breadcrumb down to the segment. Title: the segment name, with the plain-English condition
summary beneath in Muted Ink, and pills: "Live", "Shared", "418 learners". Right: secondary
"Edit conditions", secondary "Export CSV", secondary "Duplicate", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Matches 418" at 32px monospace with a delta caption "+42 since
12 Jul" and a small sparkline of the match count over the last 12 weeks (double width) | "Share
of learners 12.2%" with a 3px bar | "Average total spent 8,412.00 INR" | "Average enrolments
2.4" | "Active in last 30 days 361" with the caption "86.4%".

CONDITIONS PANEL — a read-only rendering of the builder's structure: grouped blocks with their
AND/OR joiners, each condition shown as three chips (field, operator, value) on one line, and
an "Edit conditions" text button top-right of the panel.

PROFILE OF THIS SEGMENT — an asymmetric 62/38 row:
LEFT: "How this segment differs" — one row per custom field, each showing the field label and
two overlaid horizontal bars: the segment's distribution for that field in Accent Indigo and
the whole-tenant distribution behind it in a faint Muted band, with a caption naming the largest
divergence in plain words ("94% prefer Forex, versus 41% of all learners"). Fields where the
segment matches the tenant closely are collapsed under a "Show 5 similar fields" toggle so the
distinctive ones lead.
RIGHT: three stacked panels — "Spend" (a small histogram of total spent within the segment with
the tenant median as a dashed line); "Signup cohort" (a bar per month showing when these
learners signed up); "Overlap" (a list of the three segments that share the most learners with
this one, each with the overlap count and a two-segment bar).

MATCHED LEARNERS — the roster table scoped to this segment, with the same pinned Learner column,
known columns, and custom-field columns as the main roster, plus the same columns popover and
selection bar. A caption above it reads "This list refreshes every time the segment is used."

ALSO PRODUCE: loading skeleton; the zero-match state — "No learners currently match this
segment", a sentence noting when it last matched anyone, and a secondary "Edit conditions";
inline error strip; and a 390px mobile frame where the profile panels stack.
```

---

## Screen 7 — `/admin/reports/custom-field/cohorts`

```text
Screen: Cohort actions. Route /admin/reports/custom-field/cohorts. Module tab active on
"Cohorts". Where filtered rosters and segments become saved groups and messages, and where past
actions are auditable.

HEADER
Title "Cohorts", subtitle "Groups and messages created from custom-field conditions." Right:
secondary "New group", primary "New message".

LAYOUT — asymmetric 58/42.
LEFT: "Groups created from this report" table — Group name (Accent Indigo link) | Source (a
chip pair: "Segment · Experienced traders", or "Ad-hoc filters") | Criteria (a one-line
plain-English rendering of the conditions) | Members (monospace count) | Sync pill (Static
snapshot / Live — refreshes daily) | Created by | Created on | kebab (View members, Refresh
membership, Message group, Duplicate, Delete). Show 6 rows mixing static and live.
RIGHT: "Message history" — stacked cards: subject line; an audience caption ("418 learners in
Experienced traders"); the source chip; delivery counters as inline monospace figures
(Delivered 411, Skipped 7, Opened 268, Clicked 94) with a thin stacked bar beneath; sent-by and
sent-on; a status pill (Queued / Sending / Sent / Partially failed / Scheduled); and a kebab
(View recipients, Resend to non-openers, Duplicate, Cancel schedule). Show 4 cards including one
scheduled and one partially failed with a Danger-tinted counter and a "Retry failed" text
button.

COHORT ACTIONS DRAWER — produce as its own frame, opened over the roster: header restating
"418 learners match the current filters" in 20px monospace with a "View matched learners" link
and the active conditions rendered as chips. Two segmented modes:
- Create group: a "Group name" field pre-filled with a generated suggestion built from the
  conditions ("Trading experience 3+ years"), an optional description, a sync radio (Static
  snapshot of these 418 learners / Live group, refresh daily), an "Also save these conditions
  as a segment" checkbox, and a footer primary "Create group with 418 learners".
- Send message: a "Subject" field; a rich-text body with a small toolbar and a merge-tag chip
  row that includes the custom fields themselves (learner name, trading experience, preferred
  market, signup date, total spent) inserting at the cursor, with a Warning caption "Learners
  with no value for a merge tag receive the fallback text you set below" and a fallback input
  per used tag; an "Exclude learners messaged in the last 7 days" checkbox that live-updates the
  count to "392 learners"; a channel checkbox pair (Email, In-app); a send-time radio (Now /
  Schedule) revealing a datetime picker; a "Send a test to myself" text button; and a footer
  primary "Send to 392 learners".
Both modes pass through a confirmation restating the count, and the send confirmation notes
that messages cannot be recalled.

ALSO PRODUCE: empty states for both columns ("No groups created from this report yet", "No
messages sent from this report yet"); loading skeletons; and a 390px mobile frame where the
drawer becomes a full-screen sheet and the two columns stack.
```

---

## Screen 8 — `/admin/reports/custom-field/exports`

```text
Screen: Custom Field exports. Route /admin/reports/custom-field/exports. Module tab active on
"Exports".

HEADER
Title "Exports", subtitle "Download learner attribute data or schedule recurring delivery."
Primary "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Learner roster / Field coverage / Field values / Segment members) | Scope (a
condition summary, e.g. "Segment · Experienced traders" or "Preferred market is Forex") | Rows
| Columns (a monospace count with a caption "7 learner + 9 custom") | Size | Requested by |
Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) |
action (Download, or Retry on failure). Show 7 rows covering every status; the Building row
carries a thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files
are deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly onboarding gaps"), dataset chip,
cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips, format chip, "Next run in 3
days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two schedules, one
disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Learner roster / Field coverage / Field values /
Segment members, the last revealing a segment combobox). Columns — the distinctive part of this
modal: two grouped checkbox lists exactly matching the columns popover, "Learner columns"
(learner, email, enrolments, total spent, last active on, signed up on, status) and "Custom
fields" with its own search input, a "Select all fields" control, and a running caption "16
columns selected". A Warning caption sits beside email reading "Contains learner personal
data", and a second beside the custom-field group reading "Custom fields may contain personal
information you collected — check before sharing." Filters (a read-only summary of the current
conditions with a "Use current filters" toggle, on, or a segment picker). Empty-value handling
(a radio: "Leave blank" / "Write a placeholder" revealing a text input defaulting to "Not
set"). Format (segmented CSV / XLSX / JSON). Delivery (radio: Download now / Email me when
ready / Send to recipients, revealing an email chips input and an optional webhook URL). A
"Schedule this export" toggle revealing cadence, time, and timezone. Footer: Cancel and a
primary "Create export".

ALSO PRODUCE: a ready toast "custom-field-learners-2026-08-07.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                        | Status                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Learner roster with the seven known columns plus dynamic custom-field values                          | exists                                                                                   |
| `fieldDefinitions` returned alongside the roster (id, key, label, fieldType)                          | exists                                                                                   |
| Filters: search, email, status, signed-up range, min/max total spent; sort; column picker             | exists                                                                                   |
| Async CSV export; message matched learners; create group from matched learners                        | exists                                                                                   |
| Field-type-aware condition builder (operators per type, typed value controls)                         | filters today are generic field/value pairs — typed operators need backend query support |
| Field catalogue: coverage, distinct values, most common value, last updated                           | needs backend aggregates                                                                 |
| Field detail: value distribution, orphaned values, cross-tabulation, number histograms, boolean trend | needs backend                                                                            |
| Per-learner value view, edit, and value history                                                       | `setCustomFieldValue` exists in the custom-fields domain; history/audit does not         |
| Segments: save, live match counts, refresh modes, overlap, segment-vs-tenant profile                  | needs backend                                                                            |
| Group and message history, delivery/open/click counters, scheduled sends                              | create-group and send exist; everything after them needs backend                         |
| Merge tags with per-tag fallbacks for missing values                                                  | needs backend                                                                            |
| Saved views, export history, scheduled exports, empty-value handling on export                        | export runs exist; the rest needs backend                                                |

One data-shape note: `fieldType` is a strict five-value enum in the custom-fields domain
(`text`, `number`, `boolean`, `select`, `date`) but is widened to a plain string in the report
DTO — so the UI should render defensively and fall back to the text treatment for any
unrecognised type rather than assuming the enum holds.
