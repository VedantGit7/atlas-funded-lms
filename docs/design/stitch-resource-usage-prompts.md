# Google Stitch Prompts — Resource Usage (`/admin/reports/resource-usage`)

Paste **Block 0 (Design System)** first, then **Block 0-RU (Resource Usage addendum)**, then one
screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the other report-module files; reproduced here so this file
stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminResourceUsageRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-resource-usage-roster-api.ts`
- `backend/apps/api/src/app/api/v1/reports/resource-usage/*`

Today the module is one page with four tabs — Overview (11 meter cards plus a three-card
optimization block), History, Dormant content, Inactive learners — and a CSV export scoped by
tab.

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
- Success            #15803D / #62DF7D   — healthy, reclaimed, active
- Warning            #B45309 / #E6C364   — dormant, inactive, approaching a limit
- Danger             #DC2626 / #FF8A80   — over limit, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, sizes, counts, metric keys, timestamps: JetBrains Mono.
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
- Every action that deletes, archives, or reclaims opens a confirmation that names the exact
  objects and the space or records affected, and states the consequence in plain words.

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

## Block 0-RU — Resource Usage addendum (paste second)

```text
RESOURCE USAGE MODULE ADDENDUM — applies to every screen in /admin/reports/resource-usage

WHAT THIS MODULE IS
The tenant's consumption report: how much storage, how many learners, products, questions,
tests, and messages the account is using, how that has moved over time, and what could be
reclaimed. Its audience is an operator deciding whether to clean up or to buy more. It is not a
billing screen and never quotes a price.

METERED VERSUS NOT METERED — THE HARD RULE
The API returns a `notes` object saying whether bandwidth, DRM tokens, and video transcoding
hours are actually being measured. Where a meter is not metered, its card shows the label, an em
dash in place of the value, and a Muted Ink caption "Not metered yet" — never a zero, never a
faint bar, never a placeholder number. A zero and an unmeasured meter mean completely different
things to an operator, and conflating them is the single worst failure this module can make.
Design the not-metered variant explicitly for bandwidth, DRM tokens, and video transcoding.

THE METER CARD
Every meter renders the same way: the label at 12px/600 uppercase Muted Ink; the value at 28px
monospace with its unit at 60% size in Muted Ink ("184.6" then "GB", "12,840" then "learners");
a delta caption against the previous period in plain words ("+8.4 GB in 30 days") tinted Success
when falling for cost-shaped meters and Warning when rising steeply; and a thin sparkline of the
last 12 periods along the bottom edge of the card in Accent Indigo. Cards do not use coloured
fills, borders, or icons to convey state — the number and its caption carry the meaning.

LIMITS ARE OPTIONAL AND MUST BE HONEST
Where a plan limit is known for a meter, the card gains a 3px bar with the limit at the right
end and a caption "184.6 GB of 250 GB · 73.8%", turning Warning above 80% and Danger above 95%.
Where no limit is configured, the card shows no bar at all and no percentage — never invent a
denominator, never imply a plan the tenant may not have. Design both variants.

UNITS
Storage in GB to one decimal with the unit spelled ("184.6 GB"), rolling up to TB above 1,024.
Counts as whole numbers with thousands separators. Hours to one decimal ("42.5 h"). Periods
render as their real label — "Jul 2026", "Week of 14 Jul 2026" — with the raw metric key in 10px
monospace beneath wherever a metric is named, because keys like usage.storage_gb are what
appears in exports and support tickets.

THE REAL METERS (exactly these eleven, in this order)
Storage · Active users (30d) · Current MAU · Total learners · Tests taken · Products ·
Questions · Message sends (month) · Bandwidth · DRM tokens · Video transcoding.
The last three are the not-metered ones today.

THE REAL HISTORY METRIC KEYS
usage.storage_gb · usage.total_learners · usage.products · usage.questions ·
usage.test_submits · usage.message_sends · usage.email_validations.
Note that email validations appear in history but have no live meter, and that active users,
MAU, bandwidth, DRM, and video hours have meters but no history — say so plainly in captions
rather than showing an empty chart.

RECLAIM FRAMING
Dormant content and inactive learners are opportunities, not failures. Frame every count as
what it could return: "18 dormant courses holding 42.8 GB" with a "Review" action, never
"18 problems". Any reclaim action states exactly what is freed and what is kept, and archiving
is always offered before deletion.

DATA REALISM
Course titles like "Funded Trader Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp".
Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua".
Sizes like 184.6 GB, 42.8 GB, 6.2 GB. Counts like 218, 3,412, 12,840. Periods as real months.
```

---

## Screen 1 — `/admin/reports/resource-usage` (overview)

```text
Screen: Resource Usage — overview. Route /admin/reports/resource-usage. Desktop 1440px, admin
sidebar with "Reports" expanded and "Resource Usage" active.

HEADER
Breadcrumb: Admin / Reports / Resource Usage. Title "Resource Usage", subtitle "What this
account is consuming, how it has moved, and what could be reclaimed." Right side: a "Period"
select reading "This month", a secondary "Export CSV" button, and a primary "Review reclaimable"
button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Overview · History · Storage · Dormant content · Inactive learners · Exports. Underline tabs,
active in Accent Indigo. The dormant and inactive tabs carry their counts in the label —
"Dormant content (18)", "Inactive learners (412)".

HEADLINE STRIP — not a card grid: one Panel Surface band divided by vertical hairlines into
three UNEQUAL cells. The first is double width: "Storage 184.6 GB" at 32px monospace with a
delta caption "+8.4 GB in 30 days" and a 12-period sparkline across the lower third. Then
"Learners 12,840" with the caption "3,412 active in the last 30 days". Then "Reclaimable
42.8 GB" in Warning with the caption "across 18 dormant courses" and a "Review" text button.

METERS — a full-width panel titled "Meters", holding all eleven meter cards in a responsive grid
that is deliberately NOT four equal columns: a 2-3-3-3 rhythm across four rows, with Storage
given a double-width card in the first row beside Active users (30d). Cards in order: Storage,
Active users (30d), Current MAU, Total learners, Tests taken, Products, Questions, Message sends
(month), Bandwidth, DRM tokens, Video transcoding. Render each per the addendum's meter-card
spec. The last three render the not-metered variant — em dash, "Not metered yet" caption, no
sparkline, no bar — and are grouped beneath a hairline sub-header reading "Not measured on this
plan" so they read as a deliberate group rather than as broken cards. Show two of the metered
cards with a plan-limit bar and the rest without, so both variants are proven.

RECLAIM PANEL — a full-width panel titled "Reclaimable", three rows rather than three cards,
each row a hairline-separated band with the figure on the left in 24px monospace, a plain
sentence in the middle, and an action button on the right:
  - "42.8 GB · Storage attached to 18 courses with no learner activity in 30 days · Review
    dormant content"
  - "412 · Learners with no activity in 90 days, still counted in your learner total · Review
    inactive learners"
  - "18 · Courses that are dormant and unpublished · Archive candidates"
Each row's figure is Warning-tinted. A closing caption reads "Reclaiming does not delete
anything on its own — every action asks first."

TREND ROW — asymmetric 62/38:
LEFT: "Usage over time" — a multi-line chart of the metrics that have history (storage, total
learners, products, questions, tests taken, message sends, email validations), one thin line
each on a normalised axis, with an inline legend row above that doubles as a toggle set, a
period granularity segmented control (Month / Week), and a caption naming the fastest-growing
metric. A Muted Ink note beneath: "Active users, MAU, bandwidth, DRM tokens, and video
transcoding have no history recorded."
RIGHT: two stacked panels — "Fastest growth" (a ranked list of five metrics with their period
delta as a percentage and an absolute figure, each linking to its metric detail) and "Last
calculated" (label/value rows giving the calculated-at timestamp per metric group in monospace,
with a Warning caption on anything older than 48 hours and a "Recalculate now" secondary
button).

ALSO PRODUCE as separate frames:
A. Loading — skeleton headline strip, meter cards as shimmer blocks preserving the 2-3-3-3
   rhythm, chart placeholder.
B. Empty — a new tenant with no usage recorded: meters all showing an em dash with the caption
   "No usage recorded yet", the reclaim panel replaced by a single line "Nothing to reclaim
   yet", and the chart replaced by a line-art gauge mark with "Usage history builds up over
   your first few weeks".
C. Error — inline Danger strip "Couldn't load usage meters." with Retry.
D. Mobile 390px — headline strip as a two-up grid, meters as a single column with the
   not-metered group collapsed behind a "Show 3 unmeasured meters" toggle, reclaim rows
   stacking their action buttons full width.
```

---

## Screen 2 — `/admin/reports/resource-usage/history`

```text
Screen: History. Route /admin/reports/resource-usage/history. Module tab active on "History".
The per-period record behind the meters.

HEADER
Title "History", subtitle "Recorded values for every metered resource, period by period." Right:
secondary "Export CSV", primary "Recalculate now".

SUMMARY BAND (unequal cells, first double width): "Metrics tracked 7" at 32px monospace with the
caption "of 11 meters" and a "Which are missing?" text link opening a popover listing the four
meters with no history and why | "Periods recorded 24" with "monthly since Aug 2024" |
"Last calculated 2 hours ago" with a Warning tint past 48 hours | "Largest movement Storage
+8.4 GB" | "Smallest movement Products +2".

FILTER BAR
A "Metric" select carrying the real options — All metrics, Storage, Total learners, Products,
Questions, Tests taken, Message sends, Email validations — with each option showing its raw key
in 10px monospace beside the label. Then a "Period from" and "Period to" pair, a "Granularity"
segmented control (Month / Week), and a sort select (Period ↓, Value ↓, Metric A–Z). Applied
chips beneath with "Clear all".

VIEW TOGGLE: a segmented "Chart" / "Table" control above the content.

CHART VIEW (default): one small multiple per selected metric, arranged in a two-column grid —
each panel titled with the metric label and its key beneath in 10px monospace, holding a bar
chart of value per period with a thin trend line, the unit named on the axis, and a delta
caption for the most recent period. Selecting a single metric in the filter collapses this to
one large chart with per-period value labels. Periods with no recorded value render as a hollow
tick, never as zero.

TABLE VIEW: Metric (label in Accent Indigo with the key in 10px monospace beneath, linking to
the metric detail) | Period (monospace, e.g. "Jul 2026") | Value (monospace right-aligned) |
Unit (a chip: GB, learners, products, questions, submissions, sends, validations) | Change vs
previous period (monospace signed figure with a percentage beneath, Success or Warning by
direction and meter type) | Calculated at (relative + absolute; Warning past 48 hours) | a kebab
(View metric detail, Copy metric key, Export this metric). Grouped under hairline headers by
metric when "All metrics" is selected, sorted by period descending within each group. Show 14
rows across at least four metrics.

FOOTER: "Showing 1–50 of 168 records", page-size select, paginator, and a Muted Ink caption
naming the recording cadence.

ALSO PRODUCE: loading skeleton for both views; empty state "No history recorded for this
metric"; inline error strip; and a 390px mobile frame where the small multiples stack to one
column and the table becomes label/value cards.
```

---

## Screen 3 — `/admin/reports/resource-usage/metrics/[metricKey]`

```text
Screen: Metric detail. Route /admin/reports/resource-usage/metrics/[metricKey]. Back text-link
"All metrics". Produce two variants: a metered metric with history (storage), and a meter with
no history recorded (current MAU).

HEADER
Breadcrumb: Admin / Reports / Resource Usage / History / Storage. Title: the metric label, with
the raw key beneath in monospace with a copy icon, and a chip cluster: unit, cadence ("Recorded
monthly"), and a "Metered" or "Not metered yet" pill.

HEADLINE BAND (unequal cells, first double width): "Current 184.6 GB" at 32px monospace with a
delta caption "+8.4 GB vs Jun 2026 · +4.8%" and, where a plan limit exists, a 3px bar with "of
250 GB · 73.8%" | "12-month change +62.4 GB" | "Average monthly growth +5.2 GB" | "Projected to
reach 250 GB in Feb 2027" in Warning with the caption "at the current rate" | "Last calculated
2 hours ago".

PRIMARY CHART — full-width: bars per period with a thin trend line, the unit on the axis, a
dashed horizontal line at the plan limit where one exists, and a shaded forward projection of
the next six periods drawn as an outlined extension with a caption stating plainly that it is a
straight-line projection from the last six periods, not a forecast. Missing periods render as
hollow ticks.

BREAKDOWN ROW — asymmetric 58/42, and this is where the metric's own shape matters:
LEFT: "What makes up this figure" — for storage, a horizontal stacked band split by asset type
(Video, Documents, Images, Audio, SCORM packages, Attachments, Backups) with each segment
labelled with its size and share, then a ranked list of the ten largest contributors (course
title, size, last activity) each linking to the storage detail. For a count metric such as
products or questions, this panel becomes a ranked list of the categories making up the count.
For a metric with no natural breakdown, the panel is replaced by a single Muted Ink line saying
so, rather than an empty chart.
RIGHT: two stacked panels — "Period record" (a compact table of every recorded period: period,
value, change, calculated at) and "Related" (links out as rows with chevrons: "Dormant content
holding this storage", "Storage breakdown", "Export this metric").

NO-HISTORY VARIANT — the whole body below the header is replaced by a Sunken Surface panel: the
current value at 32px monospace, the caption "This meter is read live and has no recorded
history", a plain explanation of what it counts, and a secondary "View all metrics with
history". No empty chart, no fabricated series.

ALSO PRODUCE: the not-metered variant — the headline band shows an em dash, the panel reads
"This resource is not being measured on this account" with a sentence on what would be counted
if it were, and no chart at all; a loading skeleton; and a 390px mobile frame.
```

---

## Screen 4 — `/admin/reports/resource-usage/storage`

```text
Screen: Storage breakdown. Route /admin/reports/resource-usage/storage. Module tab active on
"Storage". The screen an operator opens when storage is the number that matters.

HEADER
Title "Storage", subtitle "What is taking up space, and where it is attached." Right: secondary
"Export CSV", secondary "Recalculate now", primary "Review dormant content".

HEADLINE BAND (unequal cells, first double width): "Total 184.6 GB" at 32px monospace with a
12-period sparkline and the caption "+8.4 GB in 30 days", plus a 3px limit bar where a plan
limit exists | "Dormant 42.8 GB" in Warning with the caption "23.2% of total", clickable |
"Largest course Prop Firm Bootcamp · 18.4 GB" | "Average per course 4.4 GB" | "Files 12,408".

COMPOSITION PANEL — a full-width panel, the primary object: one horizontal stacked band across
the whole content width split by asset type — Video, Documents, Images, Audio, SCORM packages,
Attachments, Backups — in graded tints of Accent Indigo with the largest in the full accent,
each segment labelled with its size and share. Beneath the band, a legend row that doubles as a
filter: clicking a type scopes the table below. A caption names the dominant type and its
trend: "Video is 71.4% of storage and grew 6.8 GB this month."

SECOND ROW — asymmetric 58/42:
LEFT: "Growth by type" — a stacked area chart over the last 12 periods showing how the mix has
shifted, inline legend above, with a caption naming which type is growing fastest.
RIGHT: "Reclaim opportunities" — a list of rows, each with a size in monospace, a plain
sentence, and a text action: "42.8 GB · attached to courses with no activity in 30 days ·
Review"; "6.2 GB · duplicate uploads detected across 84 files · Review"; "3.1 GB · orphaned
files with no parent lesson · Review"; "1.4 GB · archived courses still holding assets ·
Review". A closing caption states nothing is deleted without confirmation.

TABLE — one row per storage holder
[checkbox] | Item (course or standalone asset title in Accent Indigo, with a type chip beneath)
| Type chip | Size (monospace right-aligned with a 3px bar scaled against the largest item) |
Share of total (percentage in monospace) | Files (monospace count) | Status pill (Published /
Draft / Archived) | Last learner activity (relative + absolute; Warning past 30 days) | Created
| kebab (Open storage detail, Open course, Archive course, Review files, Export). Rows with no
activity in 30 days carry a Warning left rail. Sortable on Size, Files, Last activity; active
sort = Size descending. Show 12 rows.

SELECTION BAR: "4 items selected · 24.6 GB" with "Archive", "Export selection", "Clear".

ALSO PRODUCE: loading skeleton; empty state "No stored assets yet"; inline error strip; and a
390px mobile frame where the composition band stacks into a labelled list and each row becomes
a card with the size bar full width.
```

---

## Screen 5 — `/admin/reports/resource-usage/dormant`

```text
Screen: Dormant content. Route /admin/reports/resource-usage/dormant. Module tab active on
"Dormant content", with its count in the tab label.

HEADER
Title "Dormant content", subtitle "Courses with no learner activity in the last 30 days, and the
storage they hold." Right: secondary "Export CSV", secondary "Dormancy settings", primary
"Archive selected" (disabled until rows are checked, showing the count and size when enabled —
"Archive selected (4 · 24.6 GB)").

HEADLINE BAND (unequal cells, first double width): "Dormant courses 18" at 32px monospace in
Warning with the caption "of 42 courses · 42.9%" and a 3px bar | "Storage held 42.8 GB" with the
caption "23.2% of total storage" | "Dormant and unpublished 11" with the caption "safest to
archive" | "Longest dormant 214 days" | "Lessons affected 218".
Beneath the band, a Muted Ink caption stating the rule: "Dormant means no learner has opened a
lesson in this course for 30 days. Change the window in dormancy settings."

FILTER BAR
Search ("Search course title"), "Status" select (Published, Draft, Archived, All), "Dormant for"
select (30+ days, 60+ days, 90+ days, 180+ days), "Storage" select (Any, Over 1 GB, Over 5 GB,
Over 10 GB), "Enrolments" select (Any, None, Fewer than 10, 10 or more), and a sort select
(Storage ↓, Dormant longest ↓, Lessons ↓, Title A–Z). Chips beneath with "Clear all" and "Save
as view". Saved-view tabs: "All dormant" (active), "Unpublished and dormant", "Large and
dormant", "Never opened", "+ New view".

TABLE — one course per row
[checkbox] | Course (title in Accent Indigo, with the course ID in 10px monospace beneath and a
copy icon) | Status pill | Lessons (monospace) | Storage (monospace with a 3px bar scaled
against the largest dormant course) | Enrolments (monospace, with "0 active" beneath in Warning
where relevant) | Last learner activity (relative + absolute, or "Never opened" in Warning) |
Dormant for (monospace "214 days" with a Warning tint past 90) | Created | kebab (Open course,
View storage detail, Archive course, Unpublish, Export). Sorted by storage descending. Show 12
rows including three never-opened and two already-archived-but-still-holding-storage rows
carrying a Muted rail and the caption "Archived · assets retained".

SELECTION BAR: "4 courses selected · 24.6 GB · 62 lessons" with "Archive", "Unpublish", "Export
selection", "Clear".

ARCHIVE MODAL — the important one: names every selected course in a scrollable monospace list
with its size, states the totals ("4 courses · 24.6 GB · 62 lessons · 118 enrolments"), then
three plain statements of consequence — learners lose access to the course, enrolment and
progress records are kept, and stored assets are retained unless the separate delete-assets
option is chosen. A "Also delete stored assets" checkbox, unchecked, with a Danger caption "This
frees 24.6 GB and cannot be undone." A required reason select. Then Cancel and a primary
"Archive 4 courses" — the button becomes a solid Danger "Archive and delete 24.6 GB" when the
asset checkbox is ticked.

DORMANCY SETTINGS DRAWER — a settings panel: "Consider a course dormant after N days without
learner activity" (default 30) with a live caption showing how many courses that threshold
produces, "Ignore courses with fewer than N lessons" (default 1), a toggle "Include unpublished
courses" (on), and a toggle "Include archived courses" (off). Footer: "Reset to defaults" and a
primary "Save".

ALSO PRODUCE: loading skeleton; the all-clear empty state — a line-art mark of a tidy shelf,
heading "No dormant content", the sentence "Every course has had learner activity in the last 30
days.", and a secondary "Dormancy settings"; inline error strip; and a 390px mobile frame where
each course is a card with the storage bar full width.
```

---

## Screen 6 — `/admin/reports/resource-usage/dormant/[courseId]`

```text
Screen: Dormant course detail. Route /admin/reports/resource-usage/dormant/[courseId]. Back
text-link "All dormant content". What exactly is this course holding, and what happens if it
goes.

HEADER
Breadcrumb down to the course. Title: the course title, with the course ID beneath in monospace
with a copy icon, and a chip cluster: status, "Dormant 214 days", "18.4 GB", "42 lessons".
Right: secondary "Open course", secondary "Export CSV", secondary "Unpublish",
destructive-outline "Archive course".

HEADLINE BAND (unequal cells, first double width): "Storage 18.4 GB" at 32px monospace with the
caption "10.0% of tenant storage" and a 3px bar | "Lessons 42" with "38 with assets" | "Files
1,204" | "Last learner activity 214 days ago" in Warning | "Enrolments 118" with the caption
"0 active in 90 days".

COMPOSITION PANEL — a horizontal stacked band split by asset type for this course alone (Video,
Documents, Images, Audio, SCORM, Attachments), each labelled with size and share, and a caption
naming the dominant type. Beneath it, a ranked list of the ten largest individual files: file
name in monospace truncated with a tooltip, type chip, size, the lesson it belongs to as a link,
and uploaded-on.

IMPACT PANEL — a Sunken Surface panel titled "If you archive this course", holding three columns
of plain statements under small headings: "Learners lose" (access to 42 lessons; 118 enrolments
become inactive; 3 certificates remain valid), "You keep" (all progress and completion records;
assessment attempts and scores; payment and invoice records), "You free" (18.4 GB, only if you
also choose to delete stored assets). No colour-coding on these columns — they are read
together.

LESSON TABLE — one row per lesson: # (monospace) | Lesson (title with a lesson-type chip) |
Assets (monospace count) | Storage (monospace with a 3px bar) | Last opened (relative +
absolute, or "Never opened" in Warning) | Learners who completed (monospace with a bar) | a
kebab (Open lesson, Review assets). Sorted by storage descending. Show 10 rows including three
never-opened lessons carrying a Warning rail.

ALSO PRODUCE: the archive modal scoped to this single course, restating its size, lessons, and
enrolments with the same "Also delete stored assets" checkbox and Danger caption; a loading
skeleton; the never-opened variant where the last-activity cell reads "Never opened" and a
Warning strip at the top of the page reads "No learner has ever opened this course"; and a 390px
mobile frame where the impact panel's three columns stack.
```

---

## Screen 7 — `/admin/reports/resource-usage/inactive-learners`

```text
Screen: Inactive learners. Route /admin/reports/resource-usage/inactive-learners. Module tab
active on "Inactive learners", with its count in the tab label.

HEADER
Title "Inactive learners", subtitle "Accounts with no activity for an extended period, still
counted in your learner total." Right: secondary "Export CSV", secondary "Inactivity settings",
primary "Message selected".

HEADLINE BAND (unequal cells, first double width): "Inactive learners 412" at 32px monospace in
Warning with the caption "of 12,840 total · 3.2%" and a 3px bar | "Never active 84" with the
caption "signed up, never opened anything" | "Inactive over a year 118" | "Enrolments held
1,204" | "Paid learners among them 96" with a Warning caption "check before deactivating".
Beneath the band, the rule caption: "Inactive means no recorded activity in 90 days. Change the
window in inactivity settings."

FILTER BAR
Search ("Search learner name or email"), "Status" select (Active, Inactive, Invited, Suspended,
All), "Inactive for" select (90+ days, 180+ days, 365+ days, Never active), "Enrolments" select
(Any, None, 1–2, 3 or more), "Paid" select (Any, Has paid, Never paid), "Signed up" date range,
and a sort select (Inactive longest ↓, Signed up ↓, Enrolments ↓, Name A–Z). Chips beneath with
"Clear all" and "Save as view". Saved-view tabs: "All inactive" (active), "Never active", "No
enrolments", "Inactive over a year", "+ New view".

TABLE — one learner per row
[checkbox] | Learner (avatar chip + name over email, name links to the member profile) | Status
pill | Enrolments (monospace count, with "0 in progress" beneath) | Last active (relative +
absolute, or "Never active" in Warning) | Inactive for (monospace "214 days", Warning past 180)
| Signed up (relative + absolute) | Paid (a "Yes" pill in Success with the lifetime amount
beneath, or an em dash) | kebab (Open member profile, Message learner, Deactivate account, View
their enrolments, Export). Never-active rows carry a Warning rail; paid learners carry a small
Success chip so they are never bulk-deactivated by accident. Sorted by inactive-for descending.
Show 12 rows across the full range.

SELECTION BAR: "38 learners selected · 6 have paid" with "Message selected", "Create group",
"Deactivate", "Export selection", "Clear" — and the paid count rendered in Warning inside the
bar itself.

MESSAGE DRAWER — header restating "38 learners have been inactive for 90 days or more", a
subject field pre-filled "We saved your place", a body with a merge-tag chip row (learner name,
last course opened, days inactive, enrolment count), an "Exclude learners messaged in the last
30 days" checkbox that live-updates the count, a channel checkbox pair, a "Send a test to
myself" text button, and a footer primary "Send to 31 learners" behind a confirmation restating
the count.

DEACTIVATE MODAL — the careful one: names the count, calls out the paid learners among them in a
Warning strip with a "Exclude the 6 paid learners" checkbox checked by default, states plainly
what deactivation does (the learner cannot sign in; enrolments, progress, and payment records
are kept; the account can be reactivated), requires a reason, then Cancel and a solid Danger
"Deactivate 32 learners".

INACTIVITY SETTINGS DRAWER — "Consider a learner inactive after N days" (default 90) with a live
count caption, a toggle "Count invited-but-never-signed-in learners as inactive" (on), and a
toggle "Exclude learners with an active paid enrolment" (off, with a caption explaining the
effect on the count).

ALSO PRODUCE: loading skeleton; the all-clear empty state; inline error strip; and a 390px
mobile frame where each learner is a card and the selection bar becomes a fixed bottom bar.
```

---

## Screen 8 — `/admin/reports/resource-usage/exports`

```text
Screen: Resource Usage exports. Route /admin/reports/resource-usage/exports. Module tab active
on "Exports".

HEADER
Title "Exports", subtitle "Download usage data or schedule recurring delivery." Primary "New
export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Meter snapshot / Metric history / Storage breakdown / Dormant content / Inactive
learners) | Scope (a filter summary, e.g. "usage.storage_gb · Aug 2024 – Aug 2026") | Rows |
Size | Requested by | Created (relative + absolute) | Status pill (Queued / Building / Ready /
Failed / Expired) | action (Download, or Retry on failure). Show 7 rows covering every status;
the Building row carries a thin determinate Accent Indigo progress bar; the Expired row is
dimmed with "Files are deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Monthly usage snapshot"), dataset chip,
cadence line ("On the 1st of each month, 06:00 Asia/Kolkata"), recipient chips, format chip,
"Next run in 24 days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two
schedules, one disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Meter snapshot / Metric history / Storage breakdown /
Dormant content / Inactive learners — each with a caption explaining the grain: "One row per
meter, as of now", "One row per metric per period", "One row per stored item", "One row per
dormant course", "One row per inactive learner"). Scope (dataset-dependent: a metric multi-select
with the real keys shown in monospace beside their labels plus a period range for history; a
search term for dormant and inactive). Columns (a two-column checkbox list matching each
dataset's real fields — dormant: course ID, title, status, lesson count, storage GB, last learner
activity, created; inactive: membership ID, learner name, email, status, last active, created —
with "Select all" and a Warning caption beside email reading "Contains learner personal data").
A Sunken Surface notice appears whenever Meter snapshot is chosen: "Bandwidth, DRM tokens, and
video transcoding are not metered on this account and will export as empty, not zero." Format
(segmented CSV / XLSX / JSON). Delivery (radio: Download now / Email me when ready / Send to
recipients, revealing an email chips input and an optional webhook URL). A "Schedule this
export" toggle revealing cadence, time, and timezone. Footer: Cancel and a primary "Create
export".

ALSO PRODUCE: a ready toast "resource-usage-storage-2026-08-07.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                                                                                                            | Status                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview meters — all eleven (storage GB, active users 30d, current MAU, total learners, tests taken, products, questions, message sends, bandwidth, DRM tokens, video transcoding hours) | exists                                                                                                                                                     |
| `notes` flags for bandwidth / DRM / video transcoding being metered                                                                                                                       | exists — the not-metered rule is backed, not invented                                                                                                      |
| Optimization block: dormant content count, inactive learner count, dormant storage GB                                                                                                     | exists                                                                                                                                                     |
| Metric history: metric key, label, period, value, unit, calculated at; filterable by metric key                                                                                           | exists                                                                                                                                                     |
| Dormant content list: course ID, title, status, lesson count, storage GB, last learner activity, created                                                                                  | exists                                                                                                                                                     |
| Inactive learner list: membership ID, name, email, status, last active, created                                                                                                           | exists                                                                                                                                                     |
| Async CSV export scoped by tab (history / dormant / inactive)                                                                                                                             | exists                                                                                                                                                     |
| Period deltas, sparklines, growth rates, projections                                                                                                                                      | history rows exist; the period-over-period derivations are not returned                                                                                    |
| Plan limits and quota bars                                                                                                                                                                | **no limit or entitlement data anywhere in the domain** — the addendum therefore defaults to the no-bar variant; wire limits only once a plan model exists |
| Storage breakdown by asset type, per-file listing, duplicate and orphan detection                                                                                                         | needs backend                                                                                                                                              |
| Per-course dormant detail (lesson-level storage, largest files, impact summary)                                                                                                           | needs backend                                                                                                                                              |
| Archive course, delete stored assets, unpublish from this report                                                                                                                          | needs backend — this module is read-only today                                                                                                             |
| Deactivate learner, message inactive learners, create group                                                                                                                               | needs backend; the messaging pattern exists in Batches, Progress & Score, Sales & Marketing, and Custom Field                                              |
| Dormancy and inactivity threshold settings                                                                                                                                                | the 30-day and 90-day windows are fixed server-side — making them configurable needs backend                                                               |
| Recalculate now                                                                                                                                                                           | needs backend                                                                                                                                              |
| Saved views, export history, scheduled exports                                                                                                                                            | export runs exist; history UI and scheduling need backend                                                                                                  |

Two coverage mismatches worth designing around rather than papering over, both already reflected
in the addendum: `usage.email_validations` appears in the history metric list but has **no live
meter**, and active users, MAU, bandwidth, DRM tokens, and video transcoding have **meters but no
history**. Captions should state this plainly instead of rendering empty charts.
