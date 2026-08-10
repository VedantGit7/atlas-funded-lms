# Google Stitch Prompts — Super Live Insights (`/admin/reports/super-live-insights`)

Paste **Block 0 (Design System)** first, then **Block 0-SL (Super Live Insights addendum)**,
then one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the other report-module files; reproduced here so this file
stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminSuperLiveInsightsRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-super-live-insights-roster-api.ts`
- `backend/packages/domain/src/reports/super-live-insights-roster.repository.ts` (count SQL)

**How this differs from Live Class Attendance.** Both report on the same live sessions, but
they answer different questions. `/admin/reports/live-class-attendance` is operational — who
attended this session, who to chase. Super Live Insights is analytical — the row _is_ the
metrics, the API returns a tenant-wide `summary` object alongside the list, and there is no
attendee drill. Design it as the analysis layer and link out to Live Class Attendance whenever
an admin needs the names behind a number. Never rebuild the attendee roster here.

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
- Success            #15803D / #62DF7D   — attended, above benchmark, healthy
- Warning            #B45309 / #E6C364   — below benchmark, still registered, scheduled
- Danger             #DC2626 / #FF8A80   — absent, cancelled, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, durations, rates, counts, IDs, timestamps: JetBrains Mono.
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

## Block 0-SL — Super Live Insights addendum (paste second)

```text
SUPER LIVE INSIGHTS MODULE ADDENDUM — applies to every screen in
/admin/reports/super-live-insights

WHAT THIS MODULE IS — AND IS NOT
The analytical layer over live sessions. Every row here is a session reduced to its numbers,
and the API returns a tenant-wide summary alongside the list. This module answers "how is live
teaching performing across the tenant" — trends, outliers, comparisons, benchmarks.
It is NOT the attendee roster. There is no per-learner list anywhere in this module. Whenever an
admin needs the names behind a figure, every count and every chart segment links out to
/admin/reports/live-class-attendance with the equivalent filter pre-applied, labelled
"View attendees". State this once per screen in a Muted Ink caption: "Learner-level detail lives
in Live Class Attendance."

THE FOUR COUNTS — GET THESE EXACTLY RIGHT
Each session carries four counts drawn from its attendance records, and they are not
interchangeable:
  - Attended — records with status attended
  - Registered — records still sitting at status registered, meaning signed up but never
    resolved to attended or absent
  - Absent — records with status absent
  - Total — every attendance record for the session; attended + registered + absent = total
Attendance rate is attended ÷ total, expressed to one decimal. Never compute a rate against
"registered" alone — Registered here is a third bucket, not the denominator. Wherever the four
counts appear together, render them as one composition: a single horizontal stacked bar split
Success (attended) / Warning (registered) / Danger (absent), full row width, with the three
counts labelled beneath in monospace and the total at the right end. A session with a large
Registered segment is a data-hygiene signal, not a turnout signal — caption it "N records were
never resolved to attended or absent".

RATE AND DURATION RENDERING
- Attendance rate: one decimal in monospace with a 3px bar — "63.2%". Warning tint below 40%.
  A null rate (no attendance records at all) renders as an em dash with the caption "No
  attendance records", never as 0.0%.
- Average duration is the mean across attended records only, in seconds, and always renders
  human-readable in monospace: "48m 12s", "1h 04m". Pair it with coverage against the session
  length where both are known: "48m 12s of 1h 04m" plus a 3px bar. Null renders as an em dash
  with "No durations recorded".
- Session duration is derived from started and ended timestamps; a session that never started
  shows an em dash, not zero.

BENCHMARKS ARE THE POINT
This is a comparison surface, so no figure stands alone. Every session-level metric is shown
against the tenant average for the current filter set: a faint Muted Ink tick on the bar plus a
delta caption in plain words — "+11.4 points above the 63.2% average". Above-average deltas in
Success, below in Warning, and never colour the base figure itself by its delta.

SESSION STATUS (real enum, exactly four)
Scheduled (Warning) · Live (Success) · Ended (Muted) · Cancelled (Danger).
Cancelled sessions show their total count and every rate as an em dash with the caption
"Session cancelled" — never zeros, which read as a turnout failure. Scheduled sessions show
their registrations and no rate at all.

DATA REALISM
Session titles like "Week 6 — Position sizing live", "Office hours — risk desk", "Onboarding
walkthrough — August intake". Courses like "Funded Trader Foundations". Batches like
"Foundations Cohort 12". Durations like 48m 12s, 1h 04m. Counts like 24, 11, 3, 38.
Rates like 63.2%, 81.4%, 38.7%.
```

---

## Screen 1 — `/admin/reports/super-live-insights` (session metrics table)

```text
Screen: Super Live Insights — session metrics. Route /admin/reports/super-live-insights. Desktop
1440px, admin sidebar with "Reports" expanded and "Super Live Insights" active.

HEADER
Breadcrumb: Admin / Reports / Super Live Insights. Title "Super Live Insights", subtitle
"Attendance performance across every live session, measured against the tenant average." Right
side: a date-range picker reading "Last 30 days", a secondary "Columns" button, a secondary
"Export CSV" button, and a primary "Compare sessions" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Sessions · Trends · Compare · Outliers · Exports. Underline tabs, active in Accent Indigo.

SUMMARY BAND — driven by the API's own summary object, unequal cells, first double width
"Sessions 84" in 32px monospace with the caption "in the last 30 days" and a thin Accent Indigo
bar strip behind the lower third showing sessions per week. Then: "Attendance rate 63.2%" with
a 3px bar and the caption "1,842 attended of 2,914 records" | "Total attended 1,842" | "Total
records 2,914" | "Average duration 44m 18s" with a coverage bar. Beneath the band, two Muted Ink
captions: the denominator rule ("Attendance rate is attended divided by all attendance records")
and the cross-link line ("Learner-level detail lives in Live Class Attendance").

COMPOSITION STRIP — a slim full-width panel directly beneath the summary: one horizontal stacked
bar across the whole content width, split Success / Warning / Danger for attended, registered,
and absent records across the entire filtered range, each segment labelled with its count and
share, and a trailing total. A caption beneath reads "204 records were never resolved to
attended or absent" in Warning where that segment is non-trivial, with a "View sessions with
unresolved records" text link.

FILTER BAR
Search input ("Search live class title"), "Status" multi-select (Scheduled, Live, Ended,
Cancelled), "Started from" and "Started to" date pickers, "Course" combobox, "Batch" combobox,
"Attendance rate" select (Any, Below 40%, 40–75%, Above 75%, No records), "Minimum attended" a
numeric input, "Duration" select (Any, Under 30 minutes, 30–60 minutes, Over 60 minutes), and a
"Sort" select (Attendance rate ↑, Attendance rate ↓, Attended ↓, Scheduled ↓, Average duration
↓). Applied-filter chips beneath with "Clear all" and "Save as view". Saved-view tabs above the
table: "All sessions" (active), "Below benchmark", "Top performers", "Unresolved records",
"Cancelled", "+ New view".

COLUMNS POPOVER — produce one frame with it open listing the real column set exactly: Live
class, Status, Course, Batch, Scheduled, Started, Ended, Duration, Attended, Registered, Absent,
Total, Avg duration, Attendance % — with checkboxes, drag handles, "Reset to default", and
Apply. Group them under two headings, "Session" and "Metrics", to keep fourteen checkboxes
legible.

TABLE — one session per row, metrics-forward
[checkbox] | Live class (title in Accent Indigo at 14px/500, with course and batch chips
beneath) | Status pill | Scheduled (monospace date and time) | Started | Ended | Duration
(monospace "1h 04m", em dash where never started) | Composition (the four-count stacked bar per
the addendum, occupying a generous column, with "24 / 11 / 3" beneath in monospace and the
total at the right) | Attended (monospace) | Registered (monospace, Warning tint where large) |
Absent (monospace) | Total (monospace) | Avg duration (monospace with a 3px coverage bar) |
Attendance % (one decimal in monospace with a 3px bar carrying the Muted benchmark tick, and a
delta caption beneath — "+11.4 pts" in Success or "−24.5 pts" in Warning) | kebab (Open session
insight, View attendees in Live Class Attendance, Compare with another session, Export session).
Rows click through to the session insight. Sortable on Attendance %, Attended, Scheduled,
Avg duration; active sort = Scheduled descending. Show 12 rows: eight ended across the full
performance range, one Live, one Scheduled with no rate, one Cancelled rendered per the
addendum, and one with a large unresolved Registered segment carrying a Warning rail.

FOOTER: "Showing 1–50 of 84 sessions", page-size select, paginator, and a filtered-total strip
on the left reading "Filtered: 1,842 attended of 2,914 records · 63.2%".

SELECTION BAR (render visible): "3 sessions selected · 412 records" with "Compare", "Export
selection", "Clear".

ALSO PRODUCE as separate frames:
A. Loading — skeleton summary band, composition strip, and rows matching exact column widths.
B. Empty — line-art mark of a bar chart with a lectern, heading "No live sessions in this
   range", one sentence, primary "Reset date range".
C. Error — inline Danger strip "Couldn't load live session insights." with Retry.
D. Mobile 390px — summary band as a two-up grid, composition strip full width, filter bar
   collapses to a search field plus a "Filters (3)" button opening a bottom sheet, each session
   a card with title, status, the composition bar full width, the rate with its delta, and the
   date.
```

---

## Screen 2 — `/admin/reports/super-live-insights/[sessionId]`

```text
Screen: Session insight. Route /admin/reports/super-live-insights/[sessionId]. Back text-link
"All sessions". A single session's numbers in context — not its attendee list.

HEADER
Breadcrumb: Admin / Reports / Super Live Insights / Week 6 — Position sizing live. Title: the
session title, with course and batch chips beneath and a status pill. Right: secondary "Export
CSV", secondary "Compare with another session", primary "View attendees" linking to the Live
Class Attendance detail for the same session.

HEADLINE BAND (unequal cells, first double width)
"Attendance rate 63.2%" at 32px monospace with a 3px bar carrying the Muted benchmark tick and
the caption "24 attended of 38 records · 11.4 points below the 74.6% average for this course" —
the delta in Warning. Then: "Attended 24" in Success | "Registered 11" in Warning with the
caption "never resolved" | "Absent 3" in Danger | "Average duration 48m 12s" with a coverage bar
against the 1h 04m session and the caption "75.3% of the session".

COMPOSITION PANEL — a full-width panel: the four-count stacked bar at 16px tall with generous
labels, each segment clickable through to Live Class Attendance filtered to that status. Beneath
it, three label/value rows giving each count with its share of total, and a closing caption
stating the arithmetic plainly: "24 attended + 11 registered + 3 absent = 38 records."

CONTEXT ROW — asymmetric 62/38:
LEFT: "How this session compares" — a horizontal axis of attendance rate from 0 to 100 with the
distribution of all sessions in the current filter drawn as a faint Muted band, this session's
rate marked with an Accent Indigo pin, the tenant average marked with a dashed line, and the
course average with a second, lighter dashed line — each labelled. A caption beneath places it
in words: "Bottom third of sessions in this course." Beneath that, a second axis doing the same
for average duration.
RIGHT: three stacked panels —
1. "Same series" — the sessions immediately before and after this one in its course or batch,
   each a row with title, date, rate with a mini bar, and a delta against this session, so
   sequence effects are visible.
2. "Timing" — label/value rows: scheduled, started with a Warning caption naming any delay over
   five minutes, ended, session duration, and a caption comparing the length against the course
   average.
3. "Related reports" — links out as rows with chevrons: "Attendee roster in Live Class
   Attendance", "Zoom meeting in Zoom Insights", "Batch report", "Course progress".

TREND STRIP — a slim full-width panel at the bottom: this session's course plotted session by
session as bars of attendance rate in chronological order, this session's bar in full Accent
Indigo and the rest at 60% tint, with a dashed line at the course average, and a caption naming
the movement ("Turnout has fallen 19 points across the last four sessions").

ALSO PRODUCE: loading skeleton; the cancelled variant — the headline band's rate cells replaced
by em dashes with a Danger-tinted panel reading "This session was cancelled on 20 Jul 2026",
the composition bar showing only the registration total; the scheduled variant — rate cells
replaced by "Not held yet" with an expected-turnout estimate clearly labelled as an estimate;
the no-records variant ("No attendance records for this session"); inline error strip; and a
390px mobile frame where the right rail stacks under the comparison axes.
```

---

## Screen 3 — `/admin/reports/super-live-insights/trends`

```text
Screen: Trends. Route /admin/reports/super-live-insights/trends. Module tab active on "Trends".
The over-time view — the question this screen answers is "is live teaching getting better or
worse, and where."

HEADER
Title "Trends", subtitle "Attendance and engagement over time, sliced by course, batch, or day
of week." Right: a date-range picker, a "Granularity" segmented control (Day / Week / Month)
with Week selected, secondary "Export CSV", primary "Compare sessions".

SUMMARY BAND (unequal cells): "Attendance rate 63.2%" at 32px monospace with a 3px bar and a
delta caption "−6.4 points vs the previous 30 days" in Warning (double width) | "Sessions 84"
with a delta | "Total attended 1,842" with a delta | "Average duration 44m 18s" with a delta |
"Best week 12–18 Jul · 78.4%" in Success.

PRIMARY CHART — a full-width panel, "Attendance rate over time": bars per period showing the
number of sessions held, with a thin Accent Indigo line overlaid for attendance rate on a
secondary axis, an inline legend row above the plot, and a dashed horizontal line at the range
average. Periods with no sessions render as an empty slot with a hollow tick, never as a zero
that drags the line down. A caption beneath names the largest single movement in plain words.
A "Break down by" select above the chart (None / Course / Batch / Session status) switches the
bars to a stacked composition, with the legend expanding accordingly.

SECOND ROW — asymmetric 58/42:
LEFT: "Composition over time" — the four-count stacked bar repeated per period, so an admin can
see whether a falling rate is driven by absences or by unresolved registrations. Each period's
bar is labelled with its total beneath. A caption calls out any period where the Registered
segment grew sharply.
RIGHT: "By day and time" — a compact matrix with days of the week down the left and time bands
across the top (Morning, Afternoon, Evening, Late), each cell holding the average attendance
rate in monospace on a background tinted by value, with a trailing pinned column and row for
day and band averages. A caption names the best and worst slot: "Evening sessions on Tuesday
average 78.1%; Friday afternoons average 41.3%."

THIRD ROW — two panels side by side, asymmetric 50/50 permitted here because they are peer
breakdowns:
"By course" and "By batch" — each a ranked list of rows: title, sessions held, attendance rate
in monospace with a 3px bar and a delta against the tenant average, and a small sparkline of
that series' rate over the range. Each row links through to the sessions table filtered to it.
Show 6 rows each, ordered by rate ascending so the weakest lead.

ALSO PRODUCE: loading skeleton with chart placeholder blocks; empty state "No sessions in this
range"; inline error strip; and a 390px mobile frame where the day-and-time matrix is replaced
by a ranked list of the top and bottom five slots.
```

---

## Screen 4 — `/admin/reports/super-live-insights/compare`

```text
Screen: Compare sessions. Route /admin/reports/super-live-insights/compare. Module tab active on
"Compare". Put two to four sessions — or two to four series — side by side on the same metrics.

HEADER
Title "Compare", subtitle "Set sessions or series against each other on the same measures."
Right: secondary "Export comparison", primary "Save comparison".

MODE CONTROL
A segmented control under the header: "Sessions" / "Series", with Sessions selected. In Series
mode the slots accept a course or batch instead of a single session, and every metric becomes an
average across that series with its session count in the caption.

SELECTION STRIP
A Sunken Surface strip with up to four slots. Each selected item renders as a chip carrying the
session title truncated to one line, its course and batch, its date, and a colour swatch from a
graded Accent Indigo ramp, with an x to remove. An empty slot is a dashed "Add session" combobox
button whose dropdown groups by course and shows each candidate's rate inline so picking is
informed. Beside the slots, a "Show" multi-select (Attendance rate, Composition, Average
duration, Session duration, Timing) with all on.

COMPARISON GRID — the primary object, a table read across, not a set of cards: rows are metrics,
columns are the selected sessions. Row header cells carry the metric name and its unit. Each
cell shows the value in 20px monospace, a 3px bar scaled against the best value in the row, and
a delta caption against the leftmost session. The best cell in each row carries an Accent Wash
tint. Metric rows: Total records, Attended, Registered, Absent, Attendance rate, Average
duration, Coverage of session length, Session duration, Start delay, Scheduled slot.

COMPOSITION ROW — beneath the grid, one four-count stacked bar per selected session, stacked
vertically on a shared width so the segment proportions line up visually, each labelled with its
session name and total. This is where the "same rate, different reasons" case becomes obvious —
a caption points it out where two sessions share a rate but differ in their absent-versus-
unresolved split.

DISTRIBUTION ROW — for the chosen primary metric, one horizontal band per session on a shared
0–100 axis showing where each sits against the whole tenant's spread, all four pins on the same
axis with the tenant average as a dashed line.

SERIES MODE VARIANT — produce as its own frame: the grid gains a "Sessions held" row, every
metric cell gains a small caption naming the session count behind the average, and the
composition row is replaced by one trend line per series plotted against a normalised x-axis
("Session 1 … Session 12") with an inline legend, so series of different lengths still compare.

ALSO PRODUCE: an empty state with two dashed slots and the line "Pick at least two sessions to
compare"; a two-item variant of the grid so the layout is proven at the minimum; a loading
skeleton; and a 390px mobile frame where the grid becomes one stacked block per metric with the
sessions listed as rows inside it.
```

---

## Screen 5 — `/admin/reports/super-live-insights/outliers`

```text
Screen: Outliers. Route /admin/reports/super-live-insights/outliers. Module tab active on
"Outliers". The triage surface — sessions that deviate enough from the norm to be worth an
admin's attention, and data-quality problems that make other numbers untrustworthy.

HEADER
Title "Outliers", subtitle "Sessions that deviate from the tenant benchmark, and records that
need cleaning up." Right: date-range picker, secondary "Detection settings", secondary "Export
CSV", primary "View attendees" (disabled until a session is selected).

TRIAGE RAIL — a left rail 220px wide listing categories with counts, the active one in Accent
Wash with an Accent Indigo left rail: All findings (34), Far below benchmark (11), Far above
benchmark (6), Unresolved records (9), No attendance records (4), Very short average duration
(3), Started very late (1). A hairline separates performance findings from data-quality
findings, with the two groups labelled "Performance" and "Data quality". Beneath the rail, a
small "Impact" block: "1,204 attendance records affected by data-quality findings" in Warning.

MAIN — a list of full-width rows, each Panel Surface with a 4px left rail coloured by severity:
a severity pill (Notable / Worth checking / Data quality); the finding stated as a sentence in
15px/600 — "Attendance fell to 31.4%, 31.8 points below this course's average"; a second line
naming the session with its course and batch; a third line of monospace evidence chips —
"24 attended", "11 unresolved", "3 absent", "rate 31.4%", "course avg 63.2%"; on the right, the
session date, a mini composition bar, and a kebab (Open session insight, View attendees, Compare
with the course average, Dismiss finding, Snooze this session). Show 6 findings across both
groups, including one "No attendance records" finding whose evidence line reads "0 records for a
session with 38 registrations expected" and one "Unresolved records" finding.

DETECTION SETTINGS DRAWER — produce as its own frame: a settings-style panel with the thresholds
that generate findings, each as a labelled numeric or select control with a plain-English
caption — "Flag a session when its rate is more than N points from its course average" (default
20), "Flag when unresolved registered records exceed N% of total" (default 20%), "Flag when
average duration is under N% of the session length" (default 25%), "Flag when a session started
more than N minutes late" (default 15), and a toggle "Ignore sessions with fewer than N records"
(default 5) with a caption explaining that small sessions produce noisy rates. A footer with
"Reset to defaults" and a primary "Save thresholds", plus a live caption showing how many
findings the current thresholds would produce.

ALSO PRODUCE: the all-clear empty state — a line-art mark of a level line, heading "Nothing
stands out in this range", the sentence "All sessions sit within the thresholds you set.", and a
secondary "Detection settings"; a loading skeleton; and a 390px mobile frame where the triage
rail becomes a horizontally scrollable chip row above the findings list.
```

---

## Screen 6 — `/admin/reports/super-live-insights/exports`

```text
Screen: Super Live Insights exports. Route /admin/reports/super-live-insights/exports. Module tab
active on "Exports".

HEADER
Title "Exports", subtitle "Download session metrics or schedule recurring delivery." Primary
"New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Session metrics / Trend series / Series rollup / Outlier findings) | Scope (a
filter summary, e.g. "Funded Trader Foundations · 1 Jul – 7 Aug 2026") | Rows | Size | Requested
by | Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) |
action (Download, or Retry on failure). Show 7 rows covering every status; the Building row
carries a thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files are
deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Monthly live teaching review"), dataset chip,
cadence line ("On the 1st of each month, 07:00 Asia/Kolkata"), recipient chips, format chip,
"Next run in 25 days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two
schedules, one disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Session metrics / Trend series / Series rollup /
Outlier findings — each with a caption explaining the grain: "One row per session", "One row per
period", "One row per course or batch", "One row per finding"). Scope (a session multi-select
combobox with "All sessions in a course", "All sessions in a batch", and "All sessions in a date
range" shortcuts, plus the date-range picker, and — for the trend dataset — a granularity
select). Columns (a two-column checkbox list matching the real column set exactly: Live class,
Status, Course, Batch, Scheduled, Started, Ended, Duration, Attended, Registered, Absent, Total,
Avg duration, Attendance % — grouped under "Session" and "Metrics", with "Select all"). A
Sunken Surface notice appears under the column list whenever the Session metrics dataset is
chosen: "This export contains aggregate counts only. For learner names and join times, export
from Live Class Attendance." Benchmarks (a checkbox "Include the tenant and course averages as
extra columns", on, with a caption naming the two columns it adds). Format (segmented CSV /
XLSX / JSON). Delivery (radio: Download now / Email me when ready / Send to recipients,
revealing an email chips input and an optional webhook URL). A "Schedule this export" toggle
revealing cadence, time, and timezone. Footer: Cancel and a primary "Create export".

ALSO PRODUCE: a ready toast "live-insights-2026-08-07.csv is ready" with a Download action; a
failed-export popover showing the error reason and Retry; and a mobile frame where schedule
cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                                      | Status                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Session metrics list: title, status, course, batch, scheduled/started/ended, duration                               | exists                                                                               |
| The four counts — attended, registered, absent, total — computed per session                                        | exists                                                                               |
| `attendanceRate` (attended ÷ total, one decimal) and `avgDurationSeconds` (attended records only)                   | exists                                                                               |
| Tenant-wide `summary` object (session count, total attended, total registered, average rate) returned with the list | exists — the summary band is already backed                                          |
| Filters: title search, status, started range, **minAttended**; sort; the full 14-column picker                      | exists                                                                               |
| Session detail (returns the same aggregate item)                                                                    | exists                                                                               |
| Async CSV export                                                                                                    | exists                                                                               |
| Benchmarks — tenant average, course average, per-metric deltas                                                      | the tenant rate is in `summary`; per-course averages and per-row deltas need backend |
| Distribution of sessions across a rate axis                                                                         | needs backend                                                                        |
| Trends over time, granularity switching, break-down-by, composition per period                                      | needs backend                                                                        |
| Day-and-time matrix                                                                                                 | derivable from `scheduledAt`, but needs a backend aggregate                          |
| By-course and by-batch rollups with sparklines                                                                      | needs backend                                                                        |
| Session comparison, series comparison, normalised series axis                                                       | needs backend                                                                        |
| Outlier detection, thresholds, dismiss/snooze findings                                                              | **done** (`/outliers` + settings drawer; dismiss/snooze client-side)                 |
| Coverage of average duration against session length                                                                 | both values exist; the ratio is not returned                                         |
| Saved views, export history, scheduled exports                                                                      | **done** (`/exports` history + schedules + New export modal)                         |

One semantic trap worth repeating for whoever builds this: **Registered is a third status bucket,
not the denominator.** `attendance_rate` is computed as attended ÷ total_count in
`super-live-insights-roster.repository.ts`, and `attended + registered + absent = total`. This
differs from how the Live Class Attendance module frames the same data, so the two reports will
show different-looking numbers for the same session unless both are read carefully — the
addendum's composition bar exists specifically to make that visible rather than confusing.
