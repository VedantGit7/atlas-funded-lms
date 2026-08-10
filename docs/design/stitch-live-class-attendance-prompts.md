# Google Stitch Prompts — Live Class Attendance (`/admin/reports/live-class-attendance`)

Paste **Block 0 (Design System)** first, then **Block 0-LA (Live Class Attendance addendum)**,
then one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the other report-module files; reproduced here so this file
stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminLiveClassAttendanceRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-live-class-attendance-roster-api.ts`
- `backend/packages/domain/src/reports/live-class-attendance-roster.dto.ts` (enums)

Today the module is one page with a two-level drill in local state — session list → session
detail plus attendees — with filters, sort, column picker, and CSV export.

Related modules to cross-link, not duplicate: **Zoom Insights** (`/admin/reports/zoom-insights`)
is the mirror of the external provider; this report is the LMS's own record. **Batches** has a
per-batch live-session view scoped to one cohort.

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
- Success            #15803D / #62DF7D   — attended, healthy, on track
- Warning            #B45309 / #E6C364   — partial, late, at risk, scheduled
- Danger             #DC2626 / #FF8A80   — absent, cancelled, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, durations, counts, IDs, timestamps: JetBrains Mono.
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

## Block 0-LA — Live Class Attendance addendum (paste second)

```text
LIVE CLASS ATTENDANCE MODULE ADDENDUM — applies to every screen in
/admin/reports/live-class-attendance

WHAT THIS MODULE IS
The LMS's own attendance record for live sessions — who registered, who turned up, how long
they stayed. Unlike Zoom Insights, which mirrors an external provider, this is native data with
a known denominator: registration. That denominator is the whole point of this report, and
every attendance figure must use it.

THE TWO STATUS SETS ARE DIFFERENT — KEEP THEM STRAIGHT
Session status (real enum, exactly four): Scheduled (Warning) · Live (Success) · Ended (Muted)
· Cancelled (Danger).
Attendee status (real enum, exactly three): Registered (Muted — signed up, did not join yet or
never joined) · Attended (Success) · Absent (Danger).
Never mix the two vocabularies, never invent "Partial" or "Excused" as a stored status. Where
partial attendance matters, express it through duration coverage, not through a fabricated
status value.

ATTENDANCE IS ALWAYS A FRACTION, NEVER A BARE COUNT
Every attendance figure pairs the count with its registration denominator and a rate:
"24 of 38 registered · 63.2%" in monospace with a 3px bar. A session with zero registrations
shows the raw attendee count with the caption "No registrations recorded" — never a divide-by-
zero percentage, never a fabricated denominator. State the rule once per screen in a Muted Ink
caption beneath the table: "Attendance rate is attendees divided by registrations."

DURATION AND COVERAGE
Durations are stored in seconds and always render human-readable in monospace: "48m 12s",
"1h 04m", "38s". Never print raw seconds. Pair every duration with coverage against the session
length: "48m 12s of 60m" plus a 3px bar and the percentage. Warning tint below half the session
length. A learner marked Attended with under 10% coverage carries a Warning caption "Joined
briefly" so a token join is never read as full attendance.

SESSION IDENTITY AND CONTEXT
A session carries a title, an optional linked course, and an optional linked batch. Always show
the title as the primary label with the course and batch as chips beneath — and where either is
absent, render "No linked course" or "No linked batch" in Muted Ink rather than omitting the
chip, because the absence is itself information. Times render as "Scheduled 19:00 · Started
19:04 · Ended 20:04" in monospace, with a Warning caption naming any start delay over five
minutes.

CROSS-PROVIDER HONESTY
Where a session was hosted on Zoom and the Zoom Insights report holds its own numbers, never
silently reconcile them. Show the LMS figure as primary, and a slim comparison line: "LMS
records 176 attendees · Zoom reports 184 · Difference 8" with a link to the Zoom meeting. State
plainly that unmatched Zoom identities are the usual cause.

CANCELLED AND FUTURE SESSIONS
A cancelled session shows its registration count, a Danger status pill, and every attendance
figure as an em dash with the caption "Session cancelled" — never zeros, which read as a
turnout failure. A scheduled future session shows registrations and an "Expected" caption
derived from that cohort's historical rate, clearly labelled as an estimate.

DATA REALISM
Session titles like "Week 6 — Position sizing live", "Office hours — risk desk", "Onboarding
walkthrough — August intake". Courses like "Funded Trader Foundations". Batches like
"Foundations Cohort 12". Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo",
"Wei-Lin Chua". Durations like 48m 12s, 1h 04m, 6m 39s. Counts like 24, 38, 186, 1,284.
Percentages like 63.2%, 74.8%, 41.3%.
```

---

## Screen 1 — `/admin/reports/live-class-attendance` (session list)

```text
Screen: Live Class Attendance — session list. Route /admin/reports/live-class-attendance.
Desktop 1440px, admin sidebar with "Reports" expanded and "Live Class Attendance" active.

HEADER
Breadcrumb: Admin / Reports / Live Class Attendance. Title "Live Class Attendance", subtitle
"Registration, turnout, and time spent for every live session." Right side: a date-range picker
reading "Last 30 days", a secondary "Export CSV" button, and a primary "Message absentees"
button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Sessions · Learners · Series · Exports. Underline tabs, active in Accent Indigo.

SIGNAL BAND (unequal cells, first is double width)
"Sessions held 84" in 32px monospace with the caption "3 cancelled · 6 scheduled ahead" and a
thin Accent Indigo bar strip behind the lower third showing sessions per week. Then: "Average
attendance 63.2%" with a 3px bar and the caption "1,842 of 2,914 registrations" | "Total time
612h 40m" | "Average coverage 74.8%" with a bar and the caption "of session length" | "Sessions
below 40% turnout 7" in Warning, clickable to filter.
Beneath the band, the attendance-rate caption from the addendum.

FILTER BAR
Search input ("Search session title"), "Status" multi-select (Scheduled, Live, Ended,
Cancelled), "Started from" and "Started to" date pickers, "Course" combobox, "Batch" combobox,
"Attendance rate" select (Any, Below 40%, 40–75%, Above 75%), "Duration" select (Any, Under 30
minutes, 30–60 minutes, Over 60 minutes), and a "Sort" select (Started ↓, Started ↑, Attendance
rate ↑, Registrations ↓). Applied-filter chips beneath with "Clear all" and "Save as view".
Saved-view tabs above the table: "All sessions" (active), "Low turnout", "Upcoming",
"Cancelled", "Unlinked", "+ New view".

TABLE — one session per row
[checkbox] | Session (title in Accent Indigo at 14px/500, with course and batch chips beneath
per the addendum) | Status pill | Scheduled (monospace date and time, with a Warning caption
naming any start delay over five minutes) | Duration (monospace "1h 04m", or the planned length
with an "Expected" caption for future sessions) | Registered (monospace count) | Attended
(monospace "24 of 38" with a 3px bar beneath and the rate; Warning tint below 40%; an em dash
with "Session cancelled" for cancelled rows) | Absent (monospace count in Danger where high) |
Average coverage (percentage with a 3px bar against session length) | Host | kebab (Open
session, View attendees, Message absentees, Export session, Open Zoom meeting, Open linked
course). Rows click through to the session detail. Sortable on Scheduled, Attended,
Registrations, Average coverage; active sort = Scheduled descending. Show 12 rows: eight ended,
one currently Live with a Success pill and a "Live now" caption plus a "Watch" text button, two
scheduled ahead grouped under a hairline "Upcoming" row at reduced emphasis, and one cancelled
rendered per the addendum.

FOOTER: "Showing 1–50 of 84 sessions", page-size select, paginator, and the Muted Ink caption
explaining the rate.

SELECTION BAR (render visible): "3 sessions selected · 114 registrations" with "Message
absentees", "Export selection", "Clear".

ALSO PRODUCE as separate frames:
A. Loading — skeleton band and rows matching exact column widths.
B. Empty — line-art mark of a lectern with a screen, heading "No live sessions in this range",
   sentence "Sessions appear here once they are scheduled in a course or batch.", primary
   "Reset date range".
C. Error — inline Danger strip "Couldn't load live sessions." with Retry.
D. Mobile 390px — signal band as a two-up grid, filter bar collapses to a search field plus a
   "Filters (3)" button opening a bottom sheet, each session a card with title, status pill,
   course and batch chips, the attendance fraction with a full-width bar, and the date.
```

---

## Screen 2 — `/admin/reports/live-class-attendance/[sessionId]`

```text
Screen: Session detail. Route /admin/reports/live-class-attendance/[sessionId]. Back text-link
"All sessions".

HEADER
Breadcrumb: Admin / Reports / Live Class Attendance / Week 6 — Position sizing live. Title: the
session title, with course and batch chips beneath and a status pill. Right: secondary
"Columns", secondary "Export CSV", secondary "Open recording", primary "Message absentees (14)"
with the count in the label.

SUMMARY BAND (unequal cells, first double width)
"Attended 24 of 38" at 32px monospace with a 3px bar and the caption "63.2% of registrations"
| "Absent 14" in Danger, clickable to filter | "Average duration 48m 12s" with a coverage bar
against the 1h 04m session and the caption "75.3% of the session" | "Scheduled 19:00 · Started
19:04" with a Warning caption "started 4 minutes late" | "Ended 20:04".

ATTENDANCE TIMELINE — a full-width panel, the primary object: a horizontal time axis spanning
the session from start to end, with a filled area showing concurrent attendees minute by minute
in Accent Indigo. A vertical marker for the scheduled start where it differs from the actual
start. Thin Warning ticks where a burst of learners left. A caption beneath names the peak and
the biggest drop: "Peak 22 concurrent at 19:12 · 6 learners left between 19:44 and 19:48."

CROSS-PROVIDER STRIP — a slim Sunken Surface line beneath the timeline, shown when the session
was hosted on Zoom: "LMS records 24 attendees · Zoom reports 27 · Difference 3" with the
explanatory caption from the addendum and a "Open Zoom meeting" text link. When no provider is
linked, this strip is omitted entirely rather than shown empty.

FILTER BAR
Learner name search, email search, "Status" select (All, Registered, Attended, Absent),
"Joined from" and "Joined to" time pickers, "Coverage" select (Any, Under 25%, 25–75%, Above
75%), "Batch" combobox, and a sort select (Joined ↓, Duration ↓, Name A–Z, Status). Chips
beneath with "Clear all".

COLUMNS POPOVER — produce one frame with it open listing the real column set: Name, Email,
Status, Joined, Left, Duration — plus a second group for the derived columns (Coverage, Batch,
Registered on), with checkboxes, drag handles, "Reset to default", and Apply.

ATTENDEES TABLE — one row per registered learner, including those who never joined
[checkbox] | Learner (avatar chip + name over email, name links to the member profile) | Status
pill (Attended / Absent / Registered) | Joined (monospace, with a "joined 9m late" caption in
Warning where applicable, or an em dash) | Left (monospace, with a "left 12m early" caption, or
an em dash) | Duration (monospace with a 3px coverage bar and the percentage beneath; for
sub-10% coverage the Warning caption "Joined briefly") | Batch chip | kebab (View learner
attendance, Open member profile, Message learner, Mark as attended, Mark as absent). Absent rows
carry a Danger left rail and dimmed time cells; Registered rows carry a Muted rail. Sorted with
absentees first by default. Show 12 rows across all three statuses, including one brief-join
row and one who joined late and left early.

SELECTION BAR: "14 learners selected" with "Message selected", "Mark as attended", "Export
selection", "Clear".

FOOTER: "Showing 1–25 of 38 registrations", page-size select, paginator, and the rate caption.

MESSAGE DRAWER — produce as its own frame: header restating "14 learners registered but did not
attend", a subject field pre-filled "You missed: Week 6 — Position sizing live", a body with a
merge-tag chip row (learner name, session title, recording link, next session date), a channel
checkbox pair (Email, In-app), a "Send a test to myself" text button, and a footer primary
"Send to 14 learners" behind a confirmation restating the count and noting sends cannot be
recalled.

ALSO PRODUCE: loading skeleton; the cancelled-session variant — the timeline replaced by a
Danger-tinted panel reading "This session was cancelled on 20 Jul 2026" with the registration
list still shown and every attendance column as an em dash; the scheduled-future variant — the
timeline replaced by a panel reading "This session has not started yet" with the registration
list, an expected-turnout estimate clearly labelled, and a primary "Message registrants"; the
zero-registration empty state; inline error strip; and a 390px mobile frame.
```

---

## Screen 3 — `/admin/reports/live-class-attendance/[sessionId]/attendees/[attendeeId]`

```text
Screen: Attendee detail. Route
/admin/reports/live-class-attendance/[sessionId]/attendees/[attendeeId]. A right-side drawer
over the session detail at 560px, AND a standalone full page for deep links. Produce both, plus
an absent variant of the drawer.

HEADER
Avatar chip, learner display name, email beneath in Muted Ink monospace, a status pill, and a
chip row: batch, "Registered 18 Jul 2026". Right / sticky footer: secondary "Open member
profile", secondary "View their attendance history", secondary "Message learner", and a
destructive-outline "Change status".

SUMMARY STRIP (unequal cells): "Time in session 48m 12s" at 28px monospace with a 3px coverage
bar against the 1h 04m session and the caption "75.3% of the session" (double width) | "Joined
19:13" with a Warning caption "9 minutes after start" | "Left 20:01" | "Rejoins 2" | "Longest
gap 6m 41s" in Warning.

PRESENCE BAND — the primary object: a horizontal band spanning the session duration, filled
Accent Indigo where the learner was present and hollow Outline where absent, with the session
start and end labelled at each end and small tick labels at each join and leave. Beneath it, a
table of the individual presence records: # (monospace) | Joined | Left | Duration | Share of
session (percentage with a mini bar) | Device chip where recorded, or "Not recorded". A caption
row summarises "2 sessions totalling 48m 12s across a 1h 04m class".

CONTEXT — two stacked panels:
1. "Attendance history" — this learner's last 10 live sessions: session title as a link, date,
   status pill, duration with a coverage bar, with the current session highlighted in Accent
   Wash, and a caption naming their overall rate ("Attended 14 of 19 sessions · 73.7%").
2. "Standing in this session" — the learner's coverage against the session's distribution: a
   horizontal axis with the cohort spread as a faint band, this learner's position as an Accent
   Indigo marker, the median as a Muted tick, and a plain caption ("Above the median of 44m
   10s").

ABSENT VARIANT — the presence band is replaced by an empty Outline track with the caption "No
join recorded", the summary strip collapses to "Registered 18 Jul 2026 · Did not join", and the
footer leads with a primary "Message learner" plus a secondary "Mark as attended" for the case
where attendance was taken outside the platform.

CHANGE STATUS MODAL — names the learner and session, offers a radio (Attended / Absent /
Registered), requires a reason where the change contradicts recorded join data, warns "This
overrides the recorded attendance and is included in the audit log", then Cancel and a primary
"Save status".

ALSO PRODUCE: loading skeleton; a single-presence-record variant with one unbroken band; and a
390px mobile frame where the drawer becomes a full-screen sheet.
```

---

## Screen 4 — `/admin/reports/live-class-attendance/[sessionId]/live`

```text
Screen: Live session monitor. Route /admin/reports/live-class-attendance/[sessionId]/live. A
watch-while-it-runs screen for a session whose status is Live. Same sidebar and top bar, but
the content runs wider and quieter — fewer controls, larger figures.

HEADER
Breadcrumb down to the session. Title: the session title at 28px/600 with course and batch
chips beneath. A "Live" pill in Success with a slow single pulse on its dot only — no other
motion on the page — and an elapsed timer "Running 42m 18s" at 20px monospace. Right: secondary
"Present mode", secondary "Open recording controls", primary "Message absentees".

TURNOUT HEADLINE — a single full-width band: "24 of 38 joined" with the number at 44px
monospace, a 6px attendance bar beneath running the full width, the rate at the right end, and
a caption "+3 in the last 5 minutes".

SECOND ROW — asymmetric 62/38:
LEFT: "Concurrent attendance" — a live area chart from session start to now, Accent Indigo,
x-axis fixed to the scheduled length so the plot fills in from the left, with a marker at the
scheduled start and a caption naming the current concurrent figure versus the peak.
RIGHT: "Joining now" — a compact ticker of the most recent 8 join and leave events, each row
with an avatar chip, the learner name, a "joined" or "left" label in Success or Muted, and a
monospace elapsed stamp; new rows enter from the top with a 150ms fade.

PRESENCE GRID — beneath: one small square per registered learner arranged in a dense grid,
tinted Success where currently present, Warning where they joined and left, hollow Outline
where they have not joined at all. Hovering a square shows the learner name and their current
state. Three counts sit above the grid as a legend row: "Present 22 · Left 2 · Not joined 14".

NOT-YET-JOINED LIST — a compact table beneath the grid, the actionable part: [checkbox] |
Learner (avatar chip + name over email) | Batch chip | Last session (their status in the
previous session, as a pill) | Attendance rate (percentage with a 3px bar) | a kebab. Sorted by
attendance rate ascending so habitual absentees lead. A selection bar offers "Send a reminder
now" with a confirmation naming the count.

ALSO PRODUCE:
A. The just-ended state of the same screen — the timer replaced by "Ended 20:04 · ran for 1h
   04m", the Live pill switched to a Muted "Ended" pill, the grid frozen with final states, and
   a primary "Open full report".
B. Present mode — sidebar and top bar hidden, session title at 40px, turnout headline at 64px,
   the concurrency chart and the presence grid only.
C. A 390px mobile frame for a host on a phone: title, elapsed timer, turnout headline, and the
   not-yet-joined list — nothing else.
```

---

## Screen 5 — `/admin/reports/live-class-attendance/learners`

```text
Screen: Attendance by learner. Route /admin/reports/live-class-attendance/learners. Module tab
active on "Learners". The people view, where the session list is the events view.

HEADER
Title "Learners", subtitle "Attendance across every live session a learner was registered for."
Right: date-range picker, secondary "Columns", secondary "Export CSV", primary "Message
low-attendance learners".

SUMMARY BAND (unequal cells, first double width): "Learners registered 486" at 32px monospace
with the caption "for at least one session in range" | "Average attendance rate 63.2%" with a
3px bar | "Never attended 41" in Danger with the caption "registered but never joined",
clickable to filter | "Perfect attendance 78" in Success | "Average coverage 74.8%" with a bar.
The rate caption from the addendum beneath.

FILTER BAR
Search ("Search learner name or email"), "Course" combobox, "Batch" combobox, "Attendance rate"
select (Any, Below 40%, 40–75%, Above 75%, Never attended), "Sessions registered" select (Any,
1, 2–5, More than 5), "Last attended" select (Any, Last 7 days, Last 30 days, Never, Not in 30
days), and a sort select (Attendance rate ↑, Sessions attended ↓, Total time ↓, Last attended
↑). Chips beneath with "Clear all" and "Save as view".

TABLE — one learner per row, with a health rail on the left edge (Warning below 40%, Danger for
never attended)
[checkbox] | Learner (avatar chip + name over email, name links to the member profile) | Batch
chip | Registered for (monospace count) | Attended (monospace "14 of 19" with a 3px bar beneath
and the rate) | Absent (monospace count in Danger where high) | Total time (monospace "12h
41m") | Average coverage (percentage with a bar; Warning tint below 40%) | Last attended
(session title as a link with the date beneath, or "Never attended" in Danger) | Streak (a
monospace figure such as "4 in a row" in Success, or "missed last 3" in Warning) | kebab (View
their attendance, Open member profile, Message learner, Export their attendance). Sortable on
Attended, Total time, Average coverage, Last attended; active sort = Attendance rate ascending
so the learners needing attention lead. Show 12 rows across the full range.

ATTENDANCE MATRIX — a second view behind a segmented "List / Matrix" toggle above the table:
learners down the left as a pinned first column (avatar chip + name), sessions across the top as
compact column headers with the session date beneath in 10px monospace. Each cell is a filled
square coloured by attendee status — Success attended, Danger absent, Muted registered-only,
hollow Outline where the learner was not registered for that session at all. A trailing pinned
column gives each learner's rate with a 3px bar; a trailing pinned row gives each session's
turnout rate. Horizontal scroll inside the container with both pins holding. A legend row above.

SELECTION BAR: "9 learners selected" with "Message learners", "Create group", "Export
selection", "Clear".

ALSO PRODUCE: loading skeleton; empty state "No learners registered for sessions in this range";
inline error strip; and a 390px mobile frame that shows the list only, with the matrix replaced
by the caption "Open on a larger screen to see the attendance matrix".
```

---

## Screen 6 — `/admin/reports/live-class-attendance/learners/[membershipId]`

```text
Screen: One learner's attendance record. Route
/admin/reports/live-class-attendance/learners/[membershipId]. Back text-link "All learners".

HEADER
Breadcrumb down to the learner. Title row: 40px avatar chip, learner display name, email beneath
in Muted Ink monospace, and pills: batch, "Registered for 19 sessions", "At risk" in Warning
where their rate is below 40%. Right: secondary "Open member profile", secondary "Message
learner", secondary "Export their attendance", secondary "Compare with cohort average" (a toggle
overlaying cohort benchmarks on every figure).

SUMMARY BAND (unequal cells, first double width): "Attended 14 of 19" at 32px monospace with a
3px bar and the caption "73.7% attendance rate", plus a Muted benchmark tick labelled "cohort
63.2%" when the compare toggle is on | "Total time 12h 41m" | "Average coverage 78.4%" with a
bar | "Current streak 4 in a row" in Success | "Last attended 2 days ago".

ATTENDANCE STRIP — a full-width band above the table: one square per session in chronological
order, coloured by status, with month labels beneath and a caption naming the longest gap
("Missed 3 consecutive sessions in June").

SESSION TABLE — one row per session the learner was registered for:
Session (title in Accent Indigo with course and batch chips beneath) | Status pill | Scheduled
(monospace date and time) | Joined | Left | Duration (monospace with a 3px coverage bar and the
percentage) | Cohort average for that session (monospace, so their turnout reads in context) |
a "View session" text link. Absent rows carry a Danger rail; brief joins carry the Warning
caption. Sorted by scheduled descending. Show 12 rows including three absences and one
brief join.

RIGHT-RAIL PANELS — an asymmetric 68/32 layout with three stacked panels on the right:
1. "Pattern" — a small chart of attendance rate per month across the learner's history, with a
   dashed cohort line behind it, and a caption naming any trend in plain words.
2. "Timing" — two figures: average minutes after start that they join, and average minutes
   before end that they leave, each with a Muted cohort comparison beneath.
3. "Related" — links out: "Their batch report", "Their progress report", "Their Zoom
   participation", each as a row with a chevron.

ALSO PRODUCE: loading skeleton; the never-attended variant — the strip all Danger squares, the
summary band showing "Attended 0 of 6" with a Danger caption, and a primary "Message learner"
promoted into the header; inline error strip; and a 390px mobile frame where the right rail
stacks beneath the session table.
```

---

## Screen 7 — `/admin/reports/live-class-attendance/series`

```text
Screen: Series rollup. Route /admin/reports/live-class-attendance/series. Module tab active on
"Series". Attendance aggregated by course or batch rather than by individual session — the view
that answers "is turnout holding up across this programme?"

HEADER
Title "Series", subtitle "Attendance trends across a whole course or batch, session by
session." Right: date-range picker, secondary "Export CSV", primary "Message low-attendance
learners".

SCOPE CONTROL
A segmented control directly under the header: "By course" / "By batch", with "By course"
selected, and a caption showing the scope: "12 courses · 84 sessions · 2,914 registrations".

SUMMARY BAND (unequal cells): "Series 12" at 32px monospace with the caption "9 running · 3
finished" (double width) | "Average turnout 63.2%" with a 3px bar | "Best series Risk Desk
Masterclass · 81.4%" in Success | "Weakest series Prop Firm Bootcamp · 38.7%" in Warning,
clickable | "Turnout trend −6.4 points over the range" in Warning.

TABLE — one course or batch per row
[checkbox] | Series (course or batch title in Accent Indigo, with the other of the pair as a
chip beneath where linked) | Sessions held (monospace, with "2 cancelled" beneath in Muted where
applicable) | Registrations (monospace) | Average turnout (percentage in monospace with a 3px
bar; Warning tint below 40%) | Trend (a small inline sparkline of turnout per session with a
delta caption "−11 points since session 1") | Average coverage (percentage with a bar) |
Learners never attending (monospace count in Danger) | Next session (date and title as a link,
or "None scheduled" in Muted Ink) | chevron. Rows expand in place to reveal the per-session
breakdown rather than navigating away. Sortable on Average turnout, Sessions, Registrations;
active sort = Average turnout ascending.

EXPANDED ROW — produce one frame with a row expanded: inside the row, a full-width panel with a
bar per session in chronological order showing turnout rate, each bar labelled with the session
number and date, cancelled sessions shown as hatched Muted bars with a "Cancelled" caption, and
a dashed horizontal line at the series average. Beneath the bars, a compact table of the same
sessions: title, date, registered, attended with its fraction and bar, average coverage, and a
"View session" link. A caption names the steepest fall: "Turnout dropped 19 points between
session 4 and session 5."

DROP-OFF PANEL — beneath the table: "Where learners stop coming" — one horizontal row per
session ordinal (Session 1, Session 2, …) showing the share of the original registrants still
attending by that point, as a funnel of descending bars, with a caption naming the biggest
single drop across all series.

ALSO PRODUCE: loading skeleton; empty state "No series with sessions in this range"; inline
error strip; and a 390px mobile frame where each series is a card with the sparkline full width
and the expanded view opening as a full-screen sheet.
```

---

## Screen 8 — `/admin/reports/live-class-attendance/exports`

```text
Screen: Live Class Attendance exports. Route /admin/reports/live-class-attendance/exports.
Module tab active on "Exports".

HEADER
Title "Exports", subtitle "Download attendance data or schedule recurring delivery." Primary
"New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Sessions / Attendees / Learner summary / Series rollup) | Scope (a filter summary,
e.g. "Foundations Cohort 12 · 1 Jul – 7 Aug 2026") | Rows | Size | Requested by | Created
(relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) | action
(Download, or Retry on failure). Show 7 rows covering every status; the Building row carries a
thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files are deleted
after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly attendance register"), dataset chip,
cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips, format chip, "Next run in 3
days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two schedules, one
disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Sessions / Attendees / Learner summary / Series
rollup — each with a caption explaining the grain: "One row per session", "One row per
registration, including learners who never joined", "One row per learner across all sessions",
"One row per course or batch"). Scope (a session multi-select combobox with "All sessions in a
course", "All sessions in a batch", and "All sessions in a date range" shortcuts, plus the
date-range picker). Columns (a two-column checkbox list matching the real set — name, email,
status, joined, left, duration — plus a second group for derived columns: coverage, batch,
registered on, session title, course; with "Select all" and a Warning caption beside email
reading "Contains learner personal data"). Registration handling (a radio: "Include learners who
never joined" / "Attendees only", with a caption naming how many rows each option produces).
Format (segmented CSV / XLSX / JSON). Delivery (radio: Download now / Email me when ready / Send
to recipients, revealing an email chips input and an optional webhook URL). A "Schedule this
export" toggle revealing cadence, time, and timezone. Footer: Cancel and a primary "Create
export".

ALSO PRODUCE: a ready toast "live-attendance-2026-08-07.csv is ready" with a Download action; a
failed-export popover showing the error reason and Retry; and a mobile frame where schedule
cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                                                 | Status                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Session list: title, status, course and batch links, scheduled/started/ended, duration, attendance count, **registered count** | exists — the denominator the addendum insists on is already there                                                       |
| Session status enum (scheduled / live / ended / cancelled)                                                                     | exists                                                                                                                  |
| Session detail: total attendance seconds, average duration                                                                     | exists                                                                                                                  |
| Attendee list: learner, email, status, joined, left, duration                                                                  | exists                                                                                                                  |
| Attendee status enum (registered / attended / absent)                                                                          | exists                                                                                                                  |
| Filters (title search, status, started range; per-attendee name/email/status/joined range), sort, column picker                | exists                                                                                                                  |
| Async CSV export                                                                                                               | exists                                                                                                                  |
| Concurrency timeline, peak and drop detection                                                                                  | join/leave times exist per attendee; the minute-by-minute aggregate needs backend                                       |
| Rejoin records per learner (multiple presence segments in one session)                                                         | the DTO carries one join/leave pair — check whether the underlying table stores more before building the presence band  |
| Coverage against session length                                                                                                | derivable from duration and session length, but not returned today                                                      |
| Manual status override (mark as attended / absent)                                                                             | needs backend                                                                                                           |
| Live monitor (elapsed timer, streaming joins, presence grid, reminder sends)                                                   | needs backend and a realtime channel                                                                                    |
| Message absentees / registrants                                                                                                | **no session-scoped messaging endpoint** — Batches, Progress & Score, and Sales & Marketing all have one to model it on |
| Attendance by learner across sessions, streaks, timing averages, cohort comparison                                             | needs backend                                                                                                           |
| Series rollup by course or batch, per-session trend, drop-off funnel                                                           | needs backend                                                                                                           |
| Cross-provider comparison against Zoom Insights                                                                                | both reports exist independently; the join and difference need backend                                                  |
| Host, recording link, device per join                                                                                          | not in the DTOs — verify against the live-session domain before rendering                                               |
| Saved views, export history, scheduled exports                                                                                 | export runs exist; history UI and scheduling need backend                                                               |
