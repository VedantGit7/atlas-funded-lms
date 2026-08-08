# Google Stitch Prompts — Progress & Score (`/admin/reports/progress-score`)

Paste **Block 0 (Design System)** first, then **Block 0-PS (Progress & Score addendum)**, then
one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in [stitch-active-devices-prompts.md](./stitch-active-devices-prompts.md)
and [stitch-payments-prompts.md](./stitch-payments-prompts.md); reproduced here so this file
stands alone.

Source of truth:
- `frontend/apps/web/src/features/admin/reports/AdminProgressScoreRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-progress-score-roster-api.ts`
- `backend/apps/api/src/app/api/v1/reports/progress-score/*`

Today the whole module is one page with a Progress/Scores tab pair, a product-type tab row,
and a three-level drill (product → quiz → learner roster). These prompts turn that drill into
addressable routes.

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
- Success            #15803D / #62DF7D   — passed, completed, healthy
- Warning            #B45309 / #E6C364   — at risk, stalled, expiring, pending
- Danger             #DC2626 / #FF8A80   — failed, expired, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, percentages, scores, counts, IDs, timestamps: JetBrains Mono.
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
  the exact recipient count and states the consequence in plain words.

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

## Block 0-PS — Progress & Score addendum (paste second)

```text
PROGRESS & SCORE MODULE ADDENDUM — applies to every screen in /admin/reports/progress-score

THE DRILL PATH
This module is a hierarchy, and every screen must make the current depth obvious:
Progress:  product type → product → learner → lesson-level detail
Scores:    product type → product → assessment → learner → attempt → question-level detail
A breadcrumb carries the full path with every ancestor clickable, and each screen keeps a
"back to <parent>" text link on the left of its title row. Never rely on browser back alone.

PROGRESS RENDERING
- Completion is always shown as a percentage in monospace PLUS the raw fraction beneath in
  11px Muted Ink: "68%" over "17 of 25 lessons". Never a percentage alone.
- Percentage cells carry a 3px-tall inline bar directly beneath the number, full row width of
  the cell, filled in Accent Indigo — Success at 100%, Warning below 25%, and a hollow Outline
  track when zero.
- Never a donut, pie, or gauge for completion. Bars and stacked bands only.
- Completion bands, used consistently in filters, charts, and legends:
  Not started (0%) · Early (1–25%) · In progress (26–75%) · Nearly done (76–99%) · Complete.

SCORE RENDERING
- Scores show one decimal in monospace: "82.5%". Where a pass mark exists, render a thin
  vertical pass-mark tick on any score bar or distribution chart, plus a caption
  "Pass mark 60%".
- Result pills use the real result set: Pass (Success), Fail (Danger), Pending (Warning),
  In progress (Muted). Never invent grades or letter marks.
- Attempt counts above one get a small monospace "×3" badge beside the score, and the score
  shown is the latest attempt with the best attempt in a caption beneath.

ENROLMENT TYPES (real set, use these exact labels as chips)
Free · Paid · Complimentary · Manual · Offline · Trial.

PRODUCT TYPES (real set)
Progress: Course · Test series · Bundle · Subscription.
Scores:   Course quiz · Test series · Bundle · Mock test.
Render the active product type as a segmented control, not as free-floating buttons.

COHORT ACTIONS
Every roster screen can turn its current filtered set into a cohort. The two actions are
"Create group" (saves the matched learners as a batch) and "Message learners" (queues an email
to them). Both must restate the matched count before committing — "This will add 148 learners
to a new group" — and both live behind a single "Cohort actions" secondary button that opens a
drawer, never as bare inline form fields on the roster.

DATA REALISM
Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua".
Products like "Funded Trader Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp".
Assessments like "Module 3 checkpoint", "Position sizing quiz", "Final mock test 02".
Percentages like 68%, 82.5%, 41.3%, 6.4%. Counts like 17, 148, 1,284.
```

---

## Screen 1 — `/admin/reports/progress-score` (module overview)

```text
Screen: Progress & Score — overview. Route /admin/reports/progress-score. Desktop 1440px,
admin sidebar with "Reports" expanded and "Progress & Score" active.

HEADER
Breadcrumb: Admin / Reports / Progress & Score. Title "Progress & Score", subtitle "Track
completion and assessment results across courses, test series, bundles, subscriptions, and
mock tests." Right side: a date-range picker reading "Last 30 days", a secondary "Export"
button, and a primary "Cohort actions" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Overview · Progress · Scores · Cohorts · Exports. Underline tabs, active in Accent Indigo.

SIGNAL BAND (unequal cells, first is double width)
"Average completion" — 61.4% in 32px monospace with a 3px inline bar beneath and a delta
caption "+4.2 points vs previous 30 days" in Success. Then: "Active enrolments 3,412" |
"Learners at risk 218" in Warning with the caption "no activity in 14 days" and clickable to a
filtered roster | "Assessment pass rate 74.8%" with a caption "1,906 attempts" | "Awaiting
grading 42" in Warning.

MAIN GRID — asymmetric 60/40
LEFT COLUMN, two stacked panels:
1. "Completion distribution" — a horizontal stacked band across the full panel width split
   into the five completion bands (Not started, Early, In progress, Nearly done, Complete) in
   graded tints of Accent Indigo with Success on Complete; each segment labelled with its
   count and share; an inline legend row beneath; clicking a segment filters the Progress
   roster. Beneath it, a small product-type segmented control that re-scopes the band.
2. "Score distribution" — a histogram of latest attempt scores in 10-point buckets, bars in
   Accent Indigo with buckets below the pass mark in Danger tint, a vertical dashed pass-mark
   line labelled "Pass mark 60%", and captions for median and mean beneath the axis.
RIGHT COLUMN, three stacked panels:
1. "Products needing attention" — a ranked list of 5 rows: product title, product-type chip,
   a completion mini-bar, and a reason caption ("38% of learners stalled below 25%",
   "Pass rate fell 11 points"). Each row is a link into its roster.
2. "Hardest assessments" — 5 rows: assessment title, parent product in Muted Ink, pass rate
   with a Danger tint below 50%, attempts count, and average score.
3. "Recent cohort actions" — a timeline of the last 5 group creations and messages: "Group
   'Stalled — Foundations' created with 148 learners by Nandita Rao", "Message sent to 62
   learners who failed Module 3 checkpoint", each with a monospace timestamp.

ENTRY ROW — beneath the grid, two wide panels side by side at 50/50 (this is the one place a
symmetric pair is allowed, because they are peer entry points): "Progress reports" with a one-
line description, the four product-type chips, and a "Open progress" primary button; and
"Score reports" with its four product-type chips and an "Open scores" primary button.

ALSO PRODUCE: loading skeleton; empty state ("No enrolment activity in this range"); inline
error strip; and a 390px mobile frame where the signal band becomes a two-up grid, charts go
full width, and the entry panels stack.
```

---

## Screen 2 — `/admin/reports/progress-score/progress`

```text
Screen: Progress — product picker. Route /admin/reports/progress-score/progress. Module tab
active on "Progress".

HEADER
Title "Progress", subtitle "Pick a product to see learner-by-learner completion." Right:
date-range picker, secondary "Export", primary "Cohort actions".

PRODUCT TYPE CONTROL
A segmented control directly under the header: Course · Test series · Bundle · Subscription,
with "Course" selected. Beneath it a caption showing the scope: "42 courses · 3,412 enrolments".

FILTER BAR
Search input ("Search product title"), "Category" combobox, "Instructor" combobox, "Status"
select (Published, Draft, Archived), "Average completion" select (Any, Below 25%, 25–75%,
Above 75%), and a "Sort" select (Enrolments ↓, Average completion ↓, Average completion ↑,
Recently updated). Applied-filter chips beneath with "Clear all".

TABLE — one product per row
Product (title in Accent Indigo, with the slug beneath in 11px monospace Muted Ink) |
Type chip | Enrolled (monospace) | Lessons (monospace) | Assessments (monospace) | Average
completion (percentage in monospace with a 3px inline bar beneath, Warning tint below 25%) |
Completion spread (a compact 5-segment stacked micro-bar showing the share in each completion
band, with a tooltip legend) | Not started (count, Warning when above a quarter of enrolled) |
Last activity (relative + absolute) | chevron.
Whole row is clickable through to the learner roster. Sortable headers on Enrolled and Average
completion; active sort = Enrolled descending. Show 10 rows with varied shapes, including one
product with 0% average and a "No activity yet" caption.

FOOTER: "Showing 1–25 of 42 products", page-size select, paginator.

ALSO PRODUCE: loading skeleton; empty state — line-art stacked-books mark, "No courses match
these filters", a "Clear filters" button; inline error strip; and a 390px mobile frame where
each product becomes a card with the completion bar full width.
```

---

## Screen 3 — `/admin/reports/progress-score/progress/[productType]/[productId]`

```text
Screen: Learner progress roster. Route
/admin/reports/progress-score/progress/[productType]/[productId]. Module tab active on
"Progress", with a back text-link "All courses".

HEADER
Breadcrumb: Admin / Reports / Progress & Score / Progress / Course / Funded Trader
Foundations. Title: the product title, with a Type chip, a "Published" pill, and a Muted Ink
subtitle "25 lessons · 4 assessments · 312 enrolled". Right: secondary "Columns", secondary
"Export CSV", secondary "Open product", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Average completion 68%" at 32px monospace with a 3px bar
beneath (double width) | "Completed 84 learners" in Success | "Stalled 47" in Warning with
the caption "no activity in 14 days", clickable to filter | "Not started 26" | "Expiring in
30 days 12".

CURRICULUM STRIP — a horizontal band above the table, one slim vertical bar per lesson in
course order, height fixed, fill proportional to the share of enrolled learners who completed
that lesson, in Accent Indigo; assessment lessons are marked with a thicker base. Hovering a
bar reveals lesson title and completion count. A caption beneath reads "Steepest drop-off:
Lesson 9 — Risk per trade (41% completion)". This is the drop-off funnel, not a separate
chart panel.

FILTER BAR
"Enrolled from" date, "Enrolled to" date, "Enrolment type" select (All types, Free, Paid,
Complimentary, Manual, Offline, Trial), "Completion band" multi-select (Not started, Early,
In progress, Nearly done, Complete), "Status" select (Active, Expired, Cancelled), "Last
activity" select (Any, Last 7 days, Last 30 days, No activity in 14 days, No activity in 30
days), a name search input, and an "Add filter" ghost button. Applied-filter chips beneath
with "Clear all" and "Save as view". Saved-view tabs above the table: "All learners" (active),
"Stalled", "Not started", "Nearly done", "+ New view".

COLUMNS POPOVER — produce one frame with it open, listing the real column set: Learner,
Email, Completion %, Completed, Total, Enrolment type, Status, Enrolled on, Expiry date —
each with a checkbox, drag handles for order, "Reset to default", and Apply.

TABLE
[checkbox] | Learner (avatar chip + name over email in Muted Ink, name links to the member
profile) | Completion (percentage in monospace, the fraction "17 of 25 lessons" beneath, and a
3px inline bar) | Last lesson completed (lesson title over its completion timestamp) | Last
activity (relative + absolute; rows with no activity in 14 days carry a Warning left rail) |
Enrolment type chip | Status pill | Enrolled on | Expiry date (Warning when within 30 days, an
em dash when none) | kebab (View learner progress, Open member profile, Send message, Extend
access, Reset progress, Unenrol). Sortable headers on Completion, Enrolled on, Expiry date;
active sort = Enrolled on descending. Show 12 rows across the full completion range including
two at 0% and one at 100%.

SELECTION BAR (render visible): "9 learners selected" with "Create group", "Message
learners", "Export selection", "Clear".

FOOTER: "Showing 1–25 of 312 learners", page-size select, paginator.

ALSO PRODUCE: loading skeleton; empty state "No learners matched these filters"; inline error
strip; and a 390px mobile frame where each learner is a card with the completion bar across
the card and the kebab top-right.
```

---

## Screen 4 — `/admin/reports/progress-score/progress/[productType]/[productId]/learners/[enrollmentId]`

```text
Screen: Individual learner progress. Route
/admin/reports/progress-score/progress/[productType]/[productId]/learners/[enrollmentId].
Full page, asymmetric 66/34, with a back text-link "All learners".

HEADER
Breadcrumb carrying the full path down to the learner name. Title row: 40px avatar chip, the
learner display name, email beneath in Muted Ink monospace, and pills: "Paid", "Active",
"Expires 14 Sep 2026". Right: secondary "Open member profile", secondary "Send message",
secondary "Extend access", destructive-outline "Reset progress".

PROGRESS BAND (unequal cells): "Completion 68%" at 32px monospace with a 3px bar and the
caption "17 of 25 lessons" (double width) | "Time on content 6h 12m" | "Last active 2 days
ago" | "Enrolled 14 Mar 2026" | "Assessments passed 2 of 4".

LEFT COLUMN — the curriculum checklist, grouped by section with a hairline section header
carrying the section title and its own "5 of 7 complete" caption:
each lesson row shows a completion state marker (a filled Success square, a half-filled
Accent Indigo square for in-progress, a hollow Outline square for not started), the lesson
title, a lesson-type chip (Video, Article, PDF, Quiz, Assignment, Live), the time spent in
monospace, the completed-on timestamp, and for video lessons a thin watch-position bar showing
how far through the learner got. Quiz rows show the score inline with a result pill and a
"View attempt" text link. Rows the learner skipped past — later lessons complete while an
earlier one is not — carry a Warning left rail and a caption "Completed out of order".

RIGHT COLUMN — three stacked panels:
1. "Activity" — a 12-week contribution strip (one small square per day, tint by minutes of
   activity, hollow for none) with month labels beneath, then a caption "Longest gap: 11 days
   in June".
2. "Assessment results" — one row per assessment: title, latest score in monospace, attempt
   count badge, result pill, and a "Review attempt" text link.
3. "Enrolment" — label/value rows: enrolment ID (monospace + copy), enrolment type, source
   (Purchase, Manual grant, Bundle, Batch), granted by, enrolled on, expiry date, access
   status, and a "Certificate issued" line with the certificate number or "Not eligible yet".

ALSO PRODUCE: the "Reset progress" modal — names the learner and the product, warns "All
lesson completions, watch positions, and time-on-content for this enrolment will be cleared.
Assessment attempts are kept.", a "Also clear assessment attempts" checkbox unchecked by
default, a required reason field, then Cancel and a solid Danger "Reset progress". Plus a
loading skeleton and a 390px mobile frame where the right column stacks under the checklist.
```

---

## Screen 5 — `/admin/reports/progress-score/scores`

```text
Screen: Scores — product picker. Route /admin/reports/progress-score/scores. Module tab active
on "Scores".

HEADER
Title "Scores", subtitle "Pick a product to see its assessments and learner results." Right:
date-range picker, secondary "Export", primary "Cohort actions".

PRODUCT TYPE CONTROL
Segmented control: Course quiz · Test series · Bundle · Mock test, with "Course quiz"
selected. Caption beneath: "38 courses · 112 assessments · 6,204 attempts".

FILTER BAR
Search ("Search product title"), "Category" combobox, "Instructor" combobox, "Pass rate"
select (Any, Below 50%, 50–75%, Above 75%), "Has ungraded attempts" toggle, and a Sort select
(Attempts ↓, Pass rate ↑, Average score ↓, Recently active).

TABLE — one product per row
Product (title in Accent Indigo, slug beneath in 11px monospace) | Type chip | Assessments
(monospace) | Learners attempted (monospace) | Attempts (monospace) | Average score
(percentage in monospace with a 3px inline bar and a pass-mark tick) | Pass rate (percentage,
Danger tint below 50%) | Ungraded (count in Warning, or an em dash) | Last attempt (relative +
absolute) | chevron. Rows click through to the assessment list. Sortable on Attempts, Average
score, Pass rate; active sort = Attempts descending. Show 10 rows including one product with
no attempts yet, rendered at reduced emphasis with "No attempts recorded".

FOOTER: count line, page-size select, paginator.

ALSO PRODUCE: loading skeleton; empty state "No products with assessments match these
filters"; inline error strip; mobile 390px card list.
```

---

## Screen 6 — `/admin/reports/progress-score/scores/[productType]/[productId]`

```text
Screen: Assessment list for a product. Route
/admin/reports/progress-score/scores/[productType]/[productId]. Module tab active on "Scores",
back text-link "All courses".

HEADER
Breadcrumb down to the product. Title: the product title with a Type chip and a Muted Ink
subtitle "4 assessments · 312 learners · 1,204 attempts". Right: secondary "Export CSV",
secondary "Open product", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Average score 71.2%" at 32px monospace with a bar and pass-mark
tick (double width) | "Pass rate 68.4%" | "Attempts 1,204" with a caption "1.9 per learner" |
"Ungraded 12" in Warning | "Median time 14m 20s".

FILTER BAR
Search ("Search assessment title"), "Assessment type" select (Quiz, Graded quiz, Mock test,
Practice set, Assignment), "Lesson" combobox, "Pass rate" select, "Has ungraded" toggle.

TABLE — one assessment per row
Assessment (title in Accent Indigo, with the assessment type chip beneath) | Lesson (parent
lesson title, or "Standalone" in Muted Ink) | Questions (monospace) | Pass mark (monospace
percentage, or "Not set" in Muted Ink) | Learners (monospace) | Attempts (monospace, with
"1.9 avg per learner" beneath) | Average score (monospace with inline bar and pass-mark tick)
| Pass rate (Danger tint below 50%) | Ungraded (Warning count or em dash) | Last attempt |
chevron. Rows click through to the learner score roster. Show 6 rows including one with no
pass mark set and one with ungraded attempts.

DIFFICULTY STRIP — beneath the table, a panel "Score spread by assessment": one horizontal
box-plot-style row per assessment showing min, quartile band, median tick, and max on a shared
0–100 axis, with the pass mark drawn as a vertical dashed line across all rows. No 3D, no
gradients.

ALSO PRODUCE: loading skeleton; empty state "This product has no assessments yet" with a
"Open product" button; error strip; mobile card list where the score spread collapses to a
simple min–median–max caption per card.
```

---

## Screen 7 — `/admin/reports/progress-score/scores/quizzes/[assessmentId]`

```text
Screen: Learner score roster for one assessment. Route
/admin/reports/progress-score/scores/quizzes/[assessmentId]. Module tab active on "Scores",
back text-link "All assessments".

HEADER
Breadcrumb down to the assessment. Title: the assessment title, with an assessment-type chip,
the parent product and lesson beneath in Muted Ink, and a "Pass mark 60%" pill (or a Warning
pill "No pass mark set"). Right: secondary "Columns", secondary "Export CSV", secondary "Open
assessment", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Average score 66.8%" at 32px monospace with a bar and pass-mark
tick (double width) | "Pass rate 61.2%" with a caption "118 of 193 learners" | "Attempts 341"
with "1.8 per learner" | "Median time 12m 04s" | "Ungraded 7" in Warning, clickable to filter.

PAGE SUB-TABS: Learners · Item analysis · Attempts.

SUB-TAB 1 — LEARNERS (default)
FILTER BAR: "Submitted from" date, "Submitted to" date, "Result" select (All, Pass, Fail,
Pending, In progress), "Score between" dual numeric inputs, "Attempts" select (Any, First
attempt only, More than one, Exhausted limit), a name search, and "Add filter". Chips beneath
with "Clear all" and "Save as view". Saved-view tabs: "All" (active), "Failed", "Ungraded",
"Improved on retry", "+ New view".
COLUMNS POPOVER frame listing the real set: Learner, Email, Result, Attempts, Score, Answered,
Submitted on.
TABLE: [checkbox] | Learner (avatar chip + name over email) | Result pill | Score (monospace
one decimal with a 3px inline bar and pass-mark tick; when attempts exceed one, a "×3" badge
sits beside it and a caption beneath reads "best 78.0%") | Attempts (monospace) | Answered
("18 of 20" in monospace with a Warning tint when incomplete) | Time taken | Submitted on
(relative + absolute) | kebab (Review latest attempt, View all attempts, Regrade, Reset
attempts, Message learner, Open member profile). Failed rows carry a Danger left rail; pending
grading rows carry a Warning rail and show "Awaiting grading" in place of the score.
Show 12 rows across all four result states. Sortable on Score, Attempts, Submitted on.
SELECTION BAR: "6 learners selected" with "Create group", "Message learners", "Regrade",
"Export selection", "Clear".
FOOTER: count line, page-size select, paginator.

SUB-TAB 2 — ITEM ANALYSIS
A table, one row per question: # (monospace) | Question text truncated to one line with a
"Preview" text link | Type chip (Single choice, Multiple choice, True/false, Numeric, Short
answer) | Correct rate (percentage in monospace with an inline bar; Danger tint below 40%) |
Average time | Discrimination index (monospace, with a Warning pill "Low" below 0.2) | Most
chosen wrong option (the option text with its share). Sorted by correct rate ascending so the
worst questions lead. Above the table a caption strip: "3 questions fall below 40% correct —
review wording or coverage." An expandable row reveals the full question, every option with
its selection share as a horizontal bar, and the correct option marked in Success.

SUB-TAB 3 — ATTEMPTS
A flat chronological table of every attempt, not grouped by learner: Attempt ID (monospace +
copy) | Learner | Attempt number | Score | Result pill | Answered | Started at | Submitted at
| Duration | Flags (chips such as "Tab switched ×2", "Submitted after time limit", "Graded
manually") | a "Review" text link. Filterable by result, date range, and flags.

ALSO PRODUCE: the "Regrade" modal — states how many attempts will be regraded and against
which version of the answer key, offers radio "Regrade selected attempts" / "Regrade all
attempts for this assessment", warns that recorded results and pass/fail outcomes may change,
a "Notify affected learners" checkbox off by default, then Cancel and a primary "Regrade 6
attempts". Plus loading skeleton, empty state, error strip, and a mobile 390px frame.
```

---

## Screen 8 — `/admin/reports/progress-score/scores/quizzes/[assessmentId]/attempts/[attemptId]`

```text
Screen: Attempt review. Route
/admin/reports/progress-score/scores/quizzes/[assessmentId]/attempts/[attemptId]. Full page,
asymmetric 68/32, with a back text-link "All learners".

HEADER
Breadcrumb down through the assessment to the learner name. Title: "Attempt 2 of 3 —
Priya Raghunathan" with the attempt ID beneath in monospace with a copy button, a Result pill
("Fail"), and a Muted Ink line "Submitted 28 Jul 2026, 19:12 IST · 14m 38s". Right: secondary
"Previous attempt", secondary "Next attempt", secondary "Open member profile", primary "Save
grading" (disabled until a manual mark changes).

SCORE BAND (unequal cells): "Score 54.0%" at 32px monospace with a bar and pass-mark tick, and
a caption "Pass mark 60% — short by 6 points" in Danger (double width) | "Correct 11 of 20" |
"Unanswered 2" in Warning | "Time taken 14m 38s of 20m" | "Attempt 2 of 3 allowed".

LEFT COLUMN — question-by-question review, one Panel Surface block per question separated by
hairlines:
the question number in monospace and a per-question result marker (Success check, Danger
cross, Warning dash for unanswered, Muted for awaiting manual grade); the question text; every
option listed as a row where the learner's choice carries an Accent Indigo left rail and the
correct option carries a Success left rail with a "Correct" label — a wrong choice shows both
rails on different rows, never colour-on-colour; beneath, a metadata line in Muted Ink
monospace: marks awarded / marks available, time spent on the question, and the cohort correct
rate for context ("64% of learners answered this correctly"). Short-answer and essay questions
render the learner's typed response in a Sunken Surface block with a manual grading control
beside it: a marks input capped at the maximum, a rubric select if configured, and an
optional feedback textarea. Include one such manually graded question in the design.

RIGHT COLUMN — three stacked panels:
1. "Attempt history" — one row per attempt for this learner on this assessment: attempt
   number, score with an up or down delta against the previous attempt, result pill, date,
   and a "View" link; the currently open attempt is highlighted with Accent Wash.
2. "Integrity" — a list of recorded flags with timestamps: tab switched twice, submitted 40
   seconds after the time limit, IP changed mid-attempt. Each with a severity pill. An empty
   variant reads "No integrity flags recorded."
3. "Actions" — secondary "Reset this attempt", secondary "Grant an extra attempt", secondary
   "Message learner", destructive-outline "Void attempt", each with a one-line caption
   explaining the effect.

STICKY FOOTER (appears once a manual mark is edited): "2 questions regraded · new score 61.0%
— result would change from Fail to Pass", with "Discard changes" and a primary "Save grading".

ALSO PRODUCE: the "Void attempt" modal restating learner, assessment, and score, requiring a
reason, warning that the attempt is excluded from all reporting but kept for audit; a loading
skeleton; and a 390px mobile frame where the right column stacks below the questions and the
grading footer becomes a fixed bottom bar.
```

---

## Screen 9 — `/admin/reports/progress-score/cohorts`

```text
Screen: Cohort actions. Route /admin/reports/progress-score/cohorts. Module tab active on
"Cohorts". This is where filtered rosters become groups and messages, and where past cohort
actions are auditable.

HEADER
Title "Cohorts", subtitle "Turn a filtered progress or score roster into a saved group, or
message the learners in it." Right: secondary "New group", primary "New message".

LAYOUT — asymmetric 58/42.
LEFT: "Groups created from reports" table — Group name (Accent Indigo link) | Source (a chip
pair showing the report and the product, e.g. "Progress · Funded Trader Foundations") |
Criteria (a one-line summary of the filters that built it, e.g. "Completion below 25% ·
enrolled before 1 Jun 2026") | Members (monospace count) | Sync (a pill: "Static snapshot" or
"Live — refreshes daily") | Created by | Created on | kebab (View members, Refresh membership,
Message group, Duplicate, Delete). Show 6 rows mixing static and live groups.
RIGHT: "Message history" — stacked cards: subject line, an audience caption ("62 learners who
failed Module 3 checkpoint"), the source report chip, delivery counters as three inline
monospace figures (Delivered 60, Skipped 2, Opened 41) with a thin stacked bar beneath, sent-by
and sent-on, a status pill (Queued / Sending / Sent / Partially failed), and a "View report"
text link. Show three cards including one partially failed with a Danger-tinted counter and a
"Retry failed" text button.

DRAWER — "Cohort actions" (the drawer opened by the Cohort actions button on every roster
screen). Produce it as a separate frame, opened over the progress roster:
a header restating the live audience — "148 learners match the current filters" in 20px
monospace with a "View matched learners" text link and a Muted Ink summary of the active
filters as chips. Then two segmented modes, "Create group" and "Send message".
- Create group mode: a "Group name" text field (pre-filled with a generated suggestion like
  "Stalled — Funded Trader Foundations"), an optional description, a sync radio ("Static
  snapshot of these 148 learners" / "Live group, refresh daily from these filters"), a
  "Also add to a batch" combobox, and a footer primary "Create group with 148 learners".
- Send message mode: a "Subject" field, a rich-text body with a small toolbar and a merge-tag
  chip row (learner name, product title, completion percentage, expiry date) that inserts at
  the cursor, a "Send to" read-only audience line with an "Exclude learners messaged in the
  last 7 days" checkbox that live-updates the count to "131 learners", a channel checkbox pair
  (Email, In-app notification), a send-time radio (Now / Schedule) revealing a datetime
  picker, a "Send a test to myself" text button, and a footer primary "Send to 131 learners".
Both modes show a confirmation step before committing that restates the count and is
irreversible for sends.

ALSO PRODUCE: an empty state for message history ("No messages sent from this report yet");
loading skeletons; and a 390px mobile frame where the drawer becomes a full-screen sheet.
```

---

## Screen 10 — `/admin/reports/progress-score/exports`

```text
Screen: Progress & Score exports. Route /admin/reports/progress-score/exports. Module tab
active on "Exports".

HEADER
Title "Exports", subtitle "Download progress and score data or schedule recurring delivery."
Primary "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Progress / Scores / Item analysis / Attempts) | Scope (a filter summary, e.g.
"Course · Funded Trader Foundations · completion below 25%") | Rows | Size | Requested by |
Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) |
action (Download, or Retry on failure). Show 7 rows covering every status; the Building row
has a thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files are
deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly stalled-learner list"), dataset
chip, cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips, format chip, "Next
run in 3 days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two
schedules, one disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Progress / Scores / Item analysis / Attempts).
Scope (a product-type segmented control plus a product combobox, and — for score datasets —
an assessment combobox with an "All assessments in this product" option). Columns (a two-
column checkbox list matching the real sets: progress — learner, email, completion %,
completed, total, enrolment type, status, enrolled on, expiry date; scores — learner, email,
result, attempts, score, answered, submitted on; with "Select all" and a Warning caption
beside email reading "Contains learner personal data"). Filters (a read-only summary of the
currently applied report filters with a "Use current filters" toggle, on, plus an explicit
date-range picker). Format (segmented CSV / XLSX / JSON). Delivery (radio: Download now /
Email me when ready / Send to recipients, revealing an email chips input and an optional
webhook URL). A "Schedule this export" toggle revealing cadence, time, and timezone. Footer:
Cancel and a primary "Create export".

ALSO PRODUCE: a ready toast "progress-foundations-2026-08-05.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature | Status |
| --- | --- |
| Progress product list per product type (course / test series / bundle / subscription) | exists |
| Progress learner roster with completion %, completed/total, enrolment type, status, dates | exists |
| Progress filters: enrolled from/to, name, enrolment type; sort; column picker | exists |
| Score product list, assessment list per product, learner score roster | exists |
| Score filters: submitted from/to, name, result status, min/max score; sort; column picker | exists (min/max score is in the API but not surfaced in the current UI) |
| Pass mark per assessment | exists (`passMarkPercent`) |
| Create group from filters, message matched learners, async CSV export | exists |
| Overview aggregates, completion distribution, score histogram, "needs attention" lists | needs backend |
| Per-product curriculum drop-off strip, stalled/last-activity signals | needs backend (lesson-level completion exists; the aggregate does not) |
| Individual learner progress detail — lesson checklist, watch position, time on content | needs backend |
| Attempt review, question-by-question, manual grading, regrade, void, extra attempt | needs backend |
| Item analysis (correct rate, discrimination, distractor shares) | needs backend |
| Integrity flags (tab switches, over-time submissions) | needs backend |
| Live/auto-refreshing groups, message history and delivery counters | groups and sends exist; history, open rates, and live sync need backend |
| Saved views, export history, scheduled exports | export runs exist; history UI and scheduling need backend |
