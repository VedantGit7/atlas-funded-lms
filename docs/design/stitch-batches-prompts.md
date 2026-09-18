# Google Stitch Prompts — Batches (`/admin/reports/batches`)

Paste **Block 0 (Design System)** first, then **Block 0-B (Batches addendum)**, then one screen
prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the Active Devices, Payments, and Progress & Score files;
reproduced here so this file stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminBatchesRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-batches-roster-api.ts`
- `backend/packages/domain/src/reports/batches-roster.*`
- Related: `AdminLiveClassAttendanceRosterPage.tsx` (the tenant-wide attendance report)

Today the module is one page holding a three-level drill in local state: batch list → batch
learner roster → learner detail with Live / Exam / Course tabs. These prompts turn that drill
into addressable routes and add the batch-level views the drill can't express.

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
- Success            #15803D / #62DF7D   — attended, passed, completed, healthy
- Warning            #B45309 / #E6C364   — partial, at risk, stalled, pending
- Danger             #DC2626 / #FF8A80   — absent, failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, percentages, durations, counts, IDs, timestamps: JetBrains Mono.
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

## Block 0-B — Batches addendum (paste second)

```text
BATCHES MODULE ADDENDUM — applies to every screen in /admin/reports/batches

WHAT A BATCH IS
A batch is a named cohort of learners, optionally linked to one course, with a start and end
date. Every batch screen reports three metric families side by side, always in this order and
always with these exact labels:
  1. Content completion — lessons finished in the linked course
  2. Live attendance — live sessions joined out of sessions held
  3. Test score — average assessment score
Where a batch has no linked course, render the affected metric as an em dash with the caption
"No linked course" in Muted Ink — never as 0%.

THE DRILL PATH
Batch list → batch report → learner detail → session or attempt detail. A breadcrumb carries
the full path with every ancestor clickable, and each screen keeps a "back to <parent>" text
link on the left of its title row.

THE TRIPLE-METRIC CELL (use everywhere a learner or batch row appears)
A metric cell shows the percentage in monospace with a 3px inline bar directly beneath it, and
the raw fraction in 11px Muted Ink under that: "72%" / bar / "18 of 25 lessons",
"64%" / bar / "9 of 14 sessions", "81%" / bar / "3 attempts". Never a percentage alone, never
a donut or gauge. Warning tint below 40%, Success at 100%.

BATCH STATUS (real set) — Active (Success) · Inactive (Warning) · Archived (Muted).
Batch window renders as "14 Mar 2026 → 30 Sep 2026" in monospace, with a caption for a live
batch reading "Week 12 of 24" and for a finished one "Ended 34 days ago".

ATTENDANCE STATES (real set for a learner in a session)
Attended (Success) · Partial (Warning, under half the session duration) · Absent (Danger) ·
Excused (Muted) · Not held yet (hollow Outline, never coloured).

HEALTH RAIL
A batch or learner row falls into one of three health bands, shown as a 4px left rail and
never as a separate column: On track (no rail), At risk (Warning rail — any one metric below
40%, or no activity in 14 days), Critical (Danger rail — two or more metrics below 40%).
State the rule in a caption under any table that uses it.

DATA REALISM
Batch names like "Foundations Cohort 12", "Risk Desk — Feb intake", "Weekend Bootcamp 04".
Batch keys as lowercase slugs in monospace: "foundations-c12". Learner names like
"Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua". Courses like "Funded
Trader Foundations". Sessions like "Week 6 — Position sizing live". Counts like 9, 14, 38,
312. Percentages like 72%, 64%, 41.3%.
```

---

## Screen 1 — `/admin/reports/batches` (batch list)

```text
Screen: Batches — report index. Route /admin/reports/batches. Desktop 1440px, admin sidebar
with "Reports" expanded and "Batches" active.

HEADER
Breadcrumb: Admin / Reports / Batches. Title "Batches", subtitle "Cohort-level completion,
live attendance, and test performance across every batch." Right side: a secondary "Compare
batches" button, a secondary "Export" button, and a primary "Manage batches" button that links
to the batch admin screen.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Batches · Compare · Exports. Underline tabs, active in Accent Indigo.

SIGNAL BAND (unequal cells, first is double width)
"Active batches" — 14 in 32px monospace with a caption "3,412 learners enrolled" and a thin
Accent Indigo bar strip behind the lower third showing learners per batch. Then: "Average
completion 61%" with a 3px bar | "Average attendance 68%" with a 3px bar | "Batches at risk 3"
in Warning, clickable to filter | "Ending in 30 days 2".

FILTER BAR
Search input ("Search batch name or key"), "Status" select (Active, Inactive, Archived, All),
"Course" combobox, "Window" select (Running now, Starting soon, Ended, Any), "Health" select
(All, On track, At risk, Critical), "Instructor" combobox, and a "Sort" select (Learners ↓,
Average completion ↑, Average attendance ↑, Start date ↓). Applied-filter chips beneath with
"Clear all" and "Save as view". Saved-view tabs above the table: "Active batches" (active),
"At risk", "Ending soon", "Archived", "+ New view".

TABLE — one batch per row, with the health rail on the left edge
[checkbox] | Batch (name in Accent Indigo over the batch key in 11px monospace Muted Ink) |
Course (linked course title, or "No linked course" in Muted Ink) | Status pill | Learners
(monospace, with "6 inactive" beneath in Warning where relevant) | Content completion (triple-
metric cell) | Live attendance (triple-metric cell) | Test score (triple-metric cell) | Window
("14 Mar 2026 → 30 Sep 2026" in monospace with a "Week 12 of 24" caption, and a thin
progress-of-window bar beneath) | Last activity (relative + absolute) | kebab (Open report,
Message learners, Compare with another batch, Export batch, Open batch settings, Archive).
Rows click through to the batch report. Sortable headers on Learners and the three metric
columns; active sort = Learners descending. Show 10 rows spanning healthy, at risk, and
critical, including one batch with no linked course (its completion and test cells show the
em dash treatment) and one archived batch at reduced emphasis.

SELECTION BAR (render visible): "3 batches selected · 486 learners" with "Message learners",
"Compare", "Export selection", "Clear".

FOOTER: "Showing 1–25 of 38 batches", page-size select, paginator, and a caption in Muted Ink
explaining the health rule: "At risk: any metric below 40% or no activity in 14 days.
Critical: two or more metrics below 40%."

ALSO PRODUCE as separate frames:
A. Loading — skeleton signal band and skeleton rows matching exact column widths.
B. Empty — line-art cohort mark (three overlapping learner outlines), heading "No batches
   match these filters", sentence "Batches are created in Admin → Batches, or generated from
   a filtered report.", primary "Manage batches".
C. Error — inline Danger strip "Couldn't load batches." with Retry.
D. Mobile 390px — signal band as a two-up grid, each batch a card with the three metric bars
   stacked full width and the health rail down the card's left edge.
```

---

## Screen 2 — `/admin/reports/batches/[batchId]` (batch report)

```text
Screen: Batch report. Route /admin/reports/batches/[batchId]. Back text-link "All batches".

HEADER
Breadcrumb: Admin / Reports / Batches / Foundations Cohort 12. Title: the batch name, with the
batch key beneath in monospace Muted Ink with a copy button, plus pills: "Active", "Week 12 of
24", "38 learners". Right: secondary "Columns", secondary "Export CSV", secondary "Batch
settings", primary "Message learners".

BATCH SUB-TAB STRIP: Overview · Learners · Live sessions · Exams · Content · Messages.

SUMMARY BAND (unequal cells, first double width)
"Content completion 72%" at 32px monospace with a 3px bar and the caption "average across 38
learners" | "Live attendance 64%" with a bar and "9 of 14 sessions held" | "Test score 81%"
with a bar and pass-mark tick | "Active in last 14 days 31 of 38" | "At risk 6" in Warning,
clickable to filter the roster.
Beneath the band, a context line in Muted Ink: "Linked course: Funded Trader Foundations ·
Window 14 Mar 2026 → 30 Sep 2026 · Created by Nandita Rao".

SUB-TAB 1 — OVERVIEW (default frame)
An asymmetric 62/38 grid.
LEFT: "Cohort trend" — a single chart with three thin lines over the batch window (content
completion, live attendance, test score) in Accent Indigo, Accent Indigo at 60% tint, and
Muted Ink, with an inline legend row above the plot, week markers on the x-axis, and a
vertical marker on today. Beneath it, "Distribution" — three stacked horizontal band charts,
one per metric, each split into 0–25 / 26–50 / 51–75 / 76–100 buckets with counts labelled,
so an admin can see the spread rather than only the average.
RIGHT: three stacked panels — "Needs attention" (a list of 5 learners with the reason and a
mini metric bar, each linking to the learner detail); "Upcoming sessions" (the next 3 live
sessions with title, scheduled time, and expected attendance); "Recent activity" (a timeline
of batch-level events: 4 learners joined, session held, exam released, message sent).

SUB-TAB 2 — LEARNERS (produce as its own frame; this is the workhorse view)
FILTER BAR: learner name search, "Joined from" date, "Joined to" date, "Completion between"
dual numeric inputs, "Attendance between" dual numeric inputs, "Health" select (All, On track,
At risk, Critical), "Activity" select (Any, Active in 7 days, No activity in 14 days), and
"Add filter". Chips beneath with "Clear all".
COLUMNS POPOVER — produce one frame with it open listing the real column set: Learner, Email,
Last activity, Live attendance %, Test score %, Content completion %, Joined on — with
checkboxes, drag handles, "Reset to default", Apply.
TABLE with the health rail: [checkbox] | Learner (avatar chip + name over email) | Last
activity (relative + absolute; Warning tint past 14 days) | Live attendance (triple-metric
cell, "64%" / bar / "9 of 14 sessions") | Test score (triple-metric cell, "78%" / bar / "3
attempts") | Content completion (triple-metric cell, "72%" / bar / "18 of 25 lessons") |
Joined on | kebab (View learner report, Open member profile, Message learner, Remove from
batch). Sortable on all three metrics, last activity, and joined on; active sort = Joined on
descending. Show 12 rows across the full health range including one learner with zero activity
since joining.
SELECTION BAR: "5 learners selected" with "Message learners", "Export selection", "Remove from
batch", "Clear".
FOOTER: "Showing 1–25 of 38 learners", page-size select, paginator.

ALSO PRODUCE: loading skeleton for both sub-tabs; empty roster state "No learners in this
batch matched the filters"; inline error strip; and a 390px mobile frame where the summary
band becomes a two-up grid and each learner is a card with three stacked metric bars.
```

---

## Screen 3 — `/admin/reports/batches/[batchId]/learners/[membershipId]`

```text
Screen: Learner report inside a batch. Route
/admin/reports/batches/[batchId]/learners/[membershipId]. Full page, asymmetric 68/32, with a
back text-link "All learners in this batch".

HEADER
Breadcrumb down through the batch to the learner name. Title row: 40px avatar chip, learner
display name, email beneath in Muted Ink monospace, and pills: "Foundations Cohort 12",
"Joined 18 Mar 2026", "At risk" in Warning. Right: secondary "Open member profile", secondary
"Message learner", secondary "Compare with cohort average" (a toggle that overlays cohort
benchmarks on every metric), destructive-outline "Remove from batch".

METRIC BAND (unequal cells, first double width)
"Content completion 72%" at 32px monospace with a 3px bar, the caption "18 of 25 lessons", and
— when the compare toggle is on — a thin Muted Ink benchmark tick on the bar labelled "cohort
72%". Then: "Live attendance 64%" with "9 of 14 sessions" | "Test score 78%" with "3 attempts"
| "Last activity 2 days ago" | "Days in batch 141".

LEFT COLUMN — a sub-tab strip: Live class attendance · Exams · Course completion.
TAB 1 — LIVE CLASS ATTENDANCE: a table, one row per session: Session (title in Accent Indigo
over the session type chip) | Scheduled (date and time in monospace) | Session status pill
(Held / Cancelled / Scheduled) | Attendance pill (Attended / Partial / Absent / Excused / Not
held yet) | Joined at | Left at | Duration (monospace "48m of 60m" with a thin coverage bar
beneath) | a "View session" text link. Absent rows carry a Danger rail, partial rows a Warning
rail, future sessions are rendered at reduced emphasis. Above the table a compact attendance
strip: one small square per session in chronological order, coloured by attendance state, with
a caption "9 attended · 2 partial · 3 absent".
TAB 2 — EXAMS: one row per attempt: Assessment (title over its type chip) | Attempt status
pill | Score (monospace with a 3px bar and a pass-mark tick) | Started at | Submitted at |
Duration | a "Review attempt" text link. A caption above reads "Average 78% across 3
attempts · best 84%".
TAB 3 — COURSE COMPLETION: one row per course in scope: Course (title in Accent Indigo) |
Completed (monospace) | Total (monospace) | Completion (percentage with a 3px bar) | Last
lesson completed | a "View progress" text link into the Progress report. Beneath the table, a
lesson-level strip for the primary course: one slim vertical bar per lesson in order, filled
for completed, hollow for not, with a caption naming the first incomplete lesson.

RIGHT COLUMN — three stacked panels:
1. "Activity" — a 12-week strip, one square per day tinted by minutes of activity, hollow for
   none, month labels beneath, and a caption "Longest gap: 11 days in June".
2. "Standing in cohort" — three rows, one per metric, each showing the learner's value, a
   horizontal axis with the cohort distribution as a faint band, the learner's position as an
   Accent Indigo marker, the cohort median as a Muted Ink tick, and a caption like "Bottom
   quartile for attendance".
3. "Batch membership" — label/value rows: membership ID (monospace + copy), joined on, added
   by, source (Manual, Report group, Purchase, Import), batch role if any, and a "Remove from
   batch" text button.

ALSO PRODUCE: the "Remove from batch" modal — names the learner and batch, states that batch
metrics recalculate and that course enrolments and progress are untouched, requires a reason,
then Cancel and a solid Danger "Remove from batch". Plus loading skeleton, the empty variants
for each tab ("No live sessions linked to this batch yet", "No exam attempts in the batch
scope", "No course progress found"), and a 390px mobile frame where the right column stacks
below the tabs.
```

---

## Screen 4 — `/admin/reports/batches/[batchId]/live-sessions`

```text
Screen: Batch live sessions. Route /admin/reports/batches/[batchId]/live-sessions. Batch
sub-tab active on "Live sessions".

HEADER
Breadcrumb down to the batch. Title "Live sessions", subtitle "Attendance for every session
held for this batch." Right: secondary "Export CSV", secondary "Open attendance report" (links
to the tenant-wide live class attendance report), primary "Message absentees".

SUMMARY BAND (unequal cells): "Average attendance 64%" at 32px monospace with a 3px bar and
the caption "across 9 sessions held" (double width) | "Sessions held 9 of 14" | "Perfect
attendance 7 learners" in Success | "Missed 3 or more 11" in Warning, clickable | "Average
watch time 44m of 60m".

VIEW TOGGLE: a segmented control "Sessions" / "Attendance matrix".

VIEW 1 — SESSIONS (default): a table, one row per session:
Session (title in Accent Indigo over the session type chip) | Scheduled (monospace date and
time with a duration caption) | Status pill (Held / Live now / Scheduled / Cancelled) | Host |
Attended (monospace "24 of 38" with a 3px bar beneath) | Attendance rate (percentage; Warning
tint below 50%) | Average watch time ("44m of 60m" with a coverage bar) | Late joins (count) |
Recording (a "View recording" text link or "Not recorded" in Muted Ink) | kebab (View session
attendance, Message absentees, Download attendance CSV, Open session). Sorted by scheduled
descending; future sessions grouped beneath a hairline row labelled "Upcoming" and rendered at
reduced emphasis. Show 8 rows including one cancelled and two upcoming.

VIEW 2 — ATTENDANCE MATRIX (produce as its own frame): a grid with learners down the left as
a pinned first column (avatar chip + name) and sessions across the top as compact rotated or
truncated column headers with the session date beneath in 10px monospace. Each cell is a
filled square coloured by attendance state, sized 28px, with a hollow Outline square for
sessions not yet held. A trailing pinned column shows each learner's attendance percentage
with a 3px bar. A trailing pinned row shows each session's attendance rate. The whole grid
scrolls horizontally inside its own container while both pinned column and row stay put. A
legend row sits above the grid, and hovering any cell shows a tooltip with learner, session,
state, and join/leave times.

ALSO PRODUCE: loading skeleton for both views; empty state "No live sessions are linked to
this batch yet" with a sentence explaining that sessions link through the batch's course; and
a 390px mobile frame where the matrix is replaced by the session list only, with a caption
"Open on a larger screen to see the attendance matrix".
```

---

## Screen 5 — `/admin/reports/batches/[batchId]/live-sessions/[sessionId]`

```text
Screen: Session attendance detail. Route
/admin/reports/batches/[batchId]/live-sessions/[sessionId]. Back text-link "All sessions".

HEADER
Breadcrumb down through the batch to the session. Title: the session title, with a Muted Ink
subtitle "Scheduled 22 Jul 2026, 19:00 IST · 60 minutes · Hosted by Rajiv Menon" and a status
pill "Held". Right: secondary "Open recording", secondary "Export CSV", primary "Message
absentees".

SUMMARY BAND (unequal cells): "Attendance 63%" at 32px monospace with a bar and "24 of 38
learners" (double width) | "Average watch time 44m" with a coverage bar against 60m | "Late
joins 6" in Warning | "Left early 4" | "Peak concurrent 27".

ATTENDANCE TIMELINE — a full-width panel: a horizontal time axis across the session duration
with a filled area showing concurrent attendance minute by minute in Accent Indigo, markers on
the axis for session start and end, and thin Warning ticks where a burst of learners left. A
caption beneath names the biggest drop: "9 learners left between 00:38 and 00:42."

TABLE — one row per batch learner, not only attendees:
[checkbox] | Learner (avatar chip + name over email) | Attendance pill (Attended / Partial /
Absent / Excused) | Joined at (monospace, or an em dash) | Left at | Watch time ("48m of 60m"
in monospace with a coverage bar beneath; Warning tint below half) | Rejoins (count) | Device
chip (Web, iOS, Android, Desktop app) | kebab (View learner report, Mark as excused, Message
learner, Open member profile). Absent rows carry a Danger rail and a dimmed watch-time cell.
Sorted with absentees first by default, and a sort select offering Watch time, Joined at, and
Name. Show 12 rows across every attendance state.
SELECTION BAR: "11 learners selected" with "Message selected", "Mark as excused", "Export
selection", "Clear".

ALSO PRODUCE: the "Message absentees" drawer — a header restating "14 learners did not attend
this session", a subject field pre-filled "You missed: Week 6 — Position sizing live", a body
with a merge-tag chip row (learner name, session title, recording link, next session date), a
channel checkbox pair (Email, In-app), a "Send a test to myself" text button, and a footer
primary "Send to 14 learners" behind a confirmation that restates the count. Plus a loading
skeleton, an empty state for a cancelled session ("This session was cancelled — no attendance
recorded"), and a 390px mobile frame.
```

---

## Screen 6 — `/admin/reports/batches/[batchId]/exams`

```text
Screen: Batch exams. Route /admin/reports/batches/[batchId]/exams. Batch sub-tab active on
"Exams".

HEADER
Breadcrumb down to the batch. Title "Exams", subtitle "Assessment results for learners in this
batch." Right: secondary "Export CSV", secondary "Open score report" (links to Progress &
Score), primary "Message learners below pass mark".

SUMMARY BAND (unequal cells): "Average score 81%" at 32px monospace with a bar and pass-mark
tick (double width) | "Pass rate 74%" with "28 of 38 learners" | "Attempts 96" with "2.5 per
learner" | "Awaiting grading 4" in Warning | "Not attempted 6" in Warning, clickable.

VIEW TOGGLE: segmented "By assessment" / "By learner".

VIEW 1 — BY ASSESSMENT: a table, one row per assessment in the batch scope:
Assessment (title in Accent Indigo over its type chip) | Released on | Attempted ("34 of 38"
in monospace with a 3px bar) | Average score (monospace with a bar and pass-mark tick) | Pass
rate (Danger tint below 50%) | Highest / Lowest (two monospace figures separated by a hairline)
| Awaiting grading (Warning count or em dash) | a "View results" text link. Beneath the table,
a "Score spread" panel: one horizontal box-plot-style row per assessment on a shared 0–100
axis showing min, quartile band, median tick, and max, with the pass mark as a vertical dashed
line across all rows.

VIEW 2 — BY LEARNER (produce as its own frame): a grid with learners down the left as a pinned
first column and assessments across the top as compact column headers. Each cell holds the
learner's latest score in monospace on a background tinted by result — Success above the pass
mark, Danger below, Warning for awaiting grading, hollow for not attempted — with the attempt
count as a tiny superscript where above one. A trailing pinned column gives the learner's
average with a 3px bar; a trailing pinned row gives each assessment's average. Horizontal
scroll inside the container with the learner column and average row pinned. A legend row above.

ALSO PRODUCE: loading skeletons; empty state "No assessments are linked to this batch yet";
inline error strip; and a 390px mobile frame that shows the by-assessment list only, with the
same "Open on a larger screen" caption for the grid.
```

---

## Screen 7 — `/admin/reports/batches/[batchId]/content`

```text
Screen: Batch content completion. Route /admin/reports/batches/[batchId]/content. Batch sub-tab
active on "Content".

HEADER
Breadcrumb down to the batch. Title "Content completion", subtitle "How far this cohort has
moved through the linked course." Right: secondary "Export CSV", secondary "Open course",
primary "Message learners who have stalled".

SUMMARY BAND (unequal cells): "Average completion 72%" at 32px monospace with a bar and the
caption "18 of 25 lessons on average" (double width) | "Finished the course 9 learners" in
Success | "Stalled 6" in Warning with "no lesson completed in 14 days", clickable | "Never
started 2" | "Median time to finish 41 days".

CURRICULUM FUNNEL — a full-width panel, the primary object of this screen: one horizontal row
per lesson in course order, each row showing the lesson number in monospace, the lesson title,
a lesson-type chip (Video, Article, PDF, Quiz, Assignment, Live), a horizontal bar filled to
the share of batch learners who completed it, the count "31 of 38" in monospace, and the
average time spent. The steepest drop between consecutive lessons is marked with a Warning
bracket on the left rail and a caption "Biggest drop-off — 11 learners stop here". Section
headers break the list with a hairline and their own aggregate. Rows are clickable to a
filtered learner list.

BESIDE IT — an asymmetric right rail at 34% holding two panels:
1. "Completion spread" — a stacked band split into 0–25 / 26–50 / 51–75 / 76–100 with counts,
   each segment clickable to filter.
2. "Pace" — a small chart of cumulative lessons completed per week across the batch window,
   with a dashed target line for the expected pace given the batch end date, and a caption
   "Cohort is 1.4 weeks behind the pace needed to finish by 30 Sep 2026."

LEARNER TABLE beneath: [checkbox] | Learner | Completion (triple-metric cell) | Last lesson
completed (title over its timestamp) | Days since last lesson (monospace; Warning past 14) |
Projected finish (a date, or "Will not finish in window" in Danger) | kebab. Sorted by days
since last lesson descending so the stalled learners lead.

ALSO PRODUCE: loading skeleton; empty state "This batch has no linked course, so content
completion cannot be reported" with a "Link a course" secondary button; error strip; and a
390px mobile frame where the funnel rows stack with the bar beneath each lesson title.
```

---

## Screen 8 — `/admin/reports/batches/[batchId]/messages`

```text
Screen: Batch messages. Route /admin/reports/batches/[batchId]/messages. Batch sub-tab active
on "Messages".

HEADER
Breadcrumb down to the batch. Title "Messages", subtitle "Announcements and nudges sent to
learners in this batch." Right: primary "New message".

LAYOUT — asymmetric 58/42.
LEFT: "Message history" — stacked cards, newest first: subject line in 15px/600; an audience
caption ("38 learners — whole batch" or "11 learners who missed Week 6"); the channel chips
(Email, In-app); delivery counters as inline monospace figures (Delivered 37, Skipped 1,
Opened 24, Clicked 9) with a thin stacked bar beneath; sent-by and sent-on in Muted Ink; a
status pill (Queued / Sending / Sent / Partially failed / Scheduled); and a kebab (View
recipients, Resend to non-openers, Duplicate, Cancel schedule). Show 5 cards including one
scheduled for the future, and one partially failed with a Danger-tinted counter and a "Retry
failed" text button.
RIGHT: two stacked panels —
1. "Automated nudges" — a list of rules that message this batch automatically, each with a
   name ("Missed two sessions in a row"), a trigger caption, an enabled toggle, a "last fired"
   line, and a kebab. A dashed "New nudge" tile at the end.
2. "Audience shortcuts" — a list of one-click audiences with live counts: whole batch (38),
   at risk (6), missed the last session (14), below pass mark (10), no activity in 14 days (7),
   never started (2). Each row has a "Message" text button that opens the composer pre-scoped.

COMPOSER DRAWER (produce as its own frame): header restating the audience — "11 learners
match" in 20px monospace with a "View recipients" text link and the audience filters as chips.
Body: "Subject" field; a rich-text body with a small toolbar and a merge-tag chip row (learner
name, batch name, course title, completion percentage, next session date, recording link) that
inserts at the cursor; an "Exclude learners messaged in the last 7 days" checkbox that live-
updates the count to "9 learners"; a channel checkbox pair; a send-time radio (Now / Schedule)
revealing a datetime picker with timezone; a "Send a test to myself" text button. Sticky
footer: "Cancel" and a primary "Send to 9 learners", behind a confirmation modal restating the
count and noting that sends cannot be recalled.

ALSO PRODUCE: empty state "No messages sent to this batch yet" with a line-art envelope mark
and a "New message" button; loading skeleton; and a 390px mobile frame where the drawer becomes
a full-screen sheet and the right rail stacks under the history.
```

---

## Screen 9 — `/admin/reports/batches/compare`

```text
Screen: Compare batches. Route /admin/reports/batches/compare. Module tab active on "Compare".

HEADER
Title "Compare batches", subtitle "Put two to four cohorts side by side on the same metrics."
Right: secondary "Export comparison", primary "Save comparison".

SELECTION STRIP
A Sunken Surface strip holding up to four batch slots as chips: each selected batch renders as
a chip with its name, key in monospace, learner count, a colour swatch assigned from a graded
Accent Indigo ramp, and an x to remove. An empty slot renders as a dashed "Add batch" combobox
button. Beside the slots, a "Normalise by" select (Absolute dates / Week of batch — so a batch
that started in February can be compared with one that started in June) defaulting to "Week of
batch", and a "Metric" multi-select (Content completion, Live attendance, Test score,
Active learners) with all four on.

COMPARISON GRID — the primary object, a table read across, not a set of cards:
rows are metrics, columns are batches. Row header cells carry the metric name and its unit.
Each cell shows the value in 20px monospace, a 3px bar scaled against the best value in the
row, and a delta caption against the leftmost batch ("−8 points"). The best cell in each row
carries an Accent Wash tint. Metric rows: Learners, Content completion, Live attendance, Test
score, Pass rate, Active in last 14 days, At-risk learners, Sessions held, Average watch time,
Median time to finish.

TREND PANEL beneath: one chart per selected metric, stacked, each plotting a line per batch in
its assigned swatch colour against the normalised x-axis ("Week 1 … Week 24"), with an inline
legend row above the first chart only and a vertical marker showing where each still-running
batch currently sits.

DISTRIBUTION PANEL: for the chosen primary metric, one horizontal distribution band per batch
stacked vertically on a shared 0–100 axis, each split into the four buckets with counts, so
spread differences are visible rather than only averages.

ALSO PRODUCE: an empty state with two dashed slots and the line "Pick at least two batches to
compare"; a two-batch variant of the grid so the layout is proven at the minimum; loading
skeleton; and a 390px mobile frame where the comparison grid becomes one stacked block per
metric with the batches listed as rows inside it.
```

---

## Screen 10 — `/admin/reports/batches/exports`

```text
Screen: Batch exports. Route /admin/reports/batches/exports. Module tab active on "Exports".

HEADER
Title "Exports", subtitle "Download batch data or schedule recurring delivery." Primary
"New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Batch summary / Batch learners / Live attendance / Exams / Content) | Scope (a
filter summary, e.g. "Foundations Cohort 12 · joined after 1 Apr 2026") | Rows | Size |
Requested by | Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed
/ Expired) | action (Download, or Retry on failure). Show 7 rows covering every status; the
Building row carries a thin determinate Accent Indigo progress bar; the Expired row is dimmed
with "Files are deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly cohort health"), dataset chip,
cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips, format chip, "Next run in
3 days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two schedules, one
disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Batch summary / Batch learners / Live attendance /
Exams / Content). Scope (a batch multi-select combobox with an "All active batches" option,
plus a date-range picker for the activity window). Columns (a two-column checkbox list; for
batch learners use the real set — learner, email, last activity, live attendance %, test
score %, content completion %, joined on — with "Select all" and a Warning caption beside
email reading "Contains learner personal data"). Filters (a read-only summary of the currently
applied report filters with a "Use current filters" toggle, on). Grouping (optional select:
none / by batch / by course / by health band, with an "Include per-group subtotals" checkbox).
Format (segmented CSV / XLSX / JSON). Delivery (radio: Download now / Email me when ready /
Send to recipients, revealing an email chips input and an optional webhook URL). A "Schedule
this export" toggle revealing cadence, time, and timezone. Footer: Cancel and a primary
"Create export".

ALSO PRODUCE: a ready toast "batch-foundations-c12-2026-08-06.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                       | Status                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Batch list with member count and the three averages, search, status filter                           | exists                                                                                                 |
| Batch detail with averages and active-learner count                                                  | exists                                                                                                 |
| Batch learner roster: last activity, attendance %, test %, completion % with fractions               | exists                                                                                                 |
| Learner filters: name, joined from/to, min/max completion; sort; column picker                       | exists (min/max completion is in the API but not surfaced in the current UI)                           |
| Learner detail: live attendance rows, exam attempts, per-course progress                             | exists                                                                                                 |
| Message matched learners, async CSV export                                                           | exists                                                                                                 |
| Health bands (at risk / critical), "ending soon", batch-level trend over the window                  | needs backend                                                                                          |
| Attendance matrix, per-session detail, concurrency timeline, late joins, watch time, rejoins, device | session rows exist per learner; the session-level aggregate, concurrency, and device data need backend |
| Mark as excused                                                                                      | needs backend                                                                                          |
| Exams by-learner grid, pass rate, awaiting grading, score spread                                     | attempt rows exist; aggregates and pass-mark joins need backend                                        |
| Content funnel per lesson, drop-off, pace vs. target, projected finish                               | per-course totals exist; lesson-level cohort aggregates need backend                                   |
| Message history, delivery/open/click counters, scheduled sends, automated nudges                     | send exists; everything after it needs backend                                                         |
| Batch comparison (normalised by week, multi-batch trend and distribution)                            | needs backend                                                                                          |
| Saved views, export history, scheduled exports                                                       | export runs exist; history UI and scheduling need backend                                              |
| Remove learner from batch                                                                            | batch membership is managed in Admin → Batches; verify the endpoint before wiring                      |
