# Google Stitch Prompts — Live Dashboard (`/admin/insights/live-dashboard`)

Paste **Block 0 (Design System)**, then **Block 0-ID (Insights module addendum)**, then
**Block 0-LD (Live Dashboard addendum)**, then one screen prompt per generation.

Block 0 and Block 0-ID are unchanged from
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) — if you are
already in that Stitch project, skip straight to Block 0-LD.

Source of truth:

- `backend/apps/api/src/server/insights/insights.service.ts`
  (`buildLiveDashboardWidgets`, `liveDashboardAlertMetrics`, `formatDurationMinutes`)
- `backend/apps/api/src/server/insights/insights-alerts.ts` (the two live-dashboard rules)
- `backend/apps/api/src/server/insights/insights.schemas.ts` (widget, layout, alert contracts)

**Two things to know before designing.** First, like Sales Insight and unlike School Vitals,
`buildLiveDashboardWidgets` takes only the snapshot — no `range`, no `deltaPct`, no `sparkline`,
no `footnote`. Windows are baked into titles. Second, this is the only insights section with a
"Live now" figure, and it is a **snapshot value read at `generatedAt`, not a stream**. Both
facts are handled explicitly in the addendum rather than designed around.

**How this differs from the two live reports.** `/admin/reports/live-class-attendance` is the
operational roster — who attended, who to chase. `/admin/reports/super-live-insights` is the
per-session analytics table. Live Dashboard is the tenant-level pulse: how much live teaching is
happening right now and across the last 30 days. It never lists a learner. Link out for names.

---

## Block 0-LD — Live Dashboard addendum (paste third)

```text
LIVE DASHBOARD SECTION ADDENDUM — applies to every screen under /admin/insights/live-dashboard

WHAT THIS SECTION ANSWERS
How much live teaching is happening, how well attended it is, and what is about to run. It is
the tenant-level pulse for live classes — not a roster and not a per-session report. There is no
learner name anywhere in this section. Every count links out to
/admin/reports/live-class-attendance for the roster and /admin/reports/super-live-insights for
per-session analytics. State this once per screen in a Muted Ink caption: "Learner-level detail
lives in Live Class Attendance."

"LIVE NOW" IS A SNAPSHOT, NOT A STREAM — SAY SO
The "Live now" KPI is computed when the section is generated. There is no realtime channel
behind it. So:
  - render "Live now" with a Muted Ink caption reading "as of 14:38:04" using the section's
    generatedAt, never a pulsing dot, never a "LIVE" badge, never an auto-incrementing counter;
  - keep the manual Refresh button prominent and put the elapsed-since-generated caption
    directly beneath it;
  - where "Live now" is greater than zero, the only motion permitted anywhere on the screen is a
    single slow pulse on one small marker beside that KPI — nothing else animates.
A screen that looks live but is four minutes stale is worse than one that plainly states its
age.

THIS SECTION DOES NOT RESPOND TO THE RANGE CONTROL
Windows are fixed in widget titles — "(30d)" — and the section is built from a snapshot with no
range parameter. Keep the range control visible for consistency but render it disabled with the
Muted Ink caption "Live Dashboard uses fixed windows shown in each widget title". Never hide it,
never let it look active. Repeat the caption once beneath the KPI region.

NO DELTAS IN THIS SECTION
No widget carries deltaPct, deltaAbs, or a sparkline. KPI cards render label and value only — no
delta caption, no bottom-edge sparkline, no comparison arrow. Where a comparison exists it is
expressed as an adjacent KPI pair — all-time beside 30-day — and those pairs must sit next to
each other so the comparison is read across two cards.

THE ATTENDANCE DENOMINATOR IS "REGISTERED / ROSTERED" — USE THAT EXACT PHRASE
The denominator KPI is labelled "Registered / rostered" because it counts both learners who
registered and learners rostered into a session by batch membership. Never shorten it to
"Registered", never call it "Expected". Attendance rate is attended ÷ registered-or-rostered as
a whole-number percentage. Where the denominator is zero, show an em dash with the caption "No
roster recorded", never 0%.

DURATIONS
"Avg watch (min)" and the per-session "Avg min" column are minute figures already converted
server-side. Render them monospace with the unit spelled once in the label, not repeated in
every cell: "48" under a column headed "Avg min". "Total watch (hrs)" is a one-decimal figure —
"612.4" — and always carries "hrs" in its label, never in the value.

THE TWELVE KPIs — exactly these, in exactly this order, all span third
Total sessions · Live now · Upcoming · Ended sessions · Total attended · Registered / rostered ·
Attendance rate % · Attendance rate % (30d) · Avg watch (min) · Total watch (hrs) ·
Sessions (30d) · Attended (30d).
Group them under three hairline sub-headers rather than a twelve-card wall: "Sessions" (Total
sessions, Live now, Upcoming, Ended sessions), "Attendance" (Total attended, Registered /
rostered, Attendance rate %, Attendance rate % (30d)), "Watch time and recent activity" (Avg
watch (min), Total watch (hrs), Sessions (30d), Attended (30d)).
Both attendance-rate KPIs are whole-number percentages with a trailing % and a 3px bar.

THE SIX WIDGETS — exactly these titles, in exactly this order
1. Live sessions by status — bar — half
2. Attendance by session status — bar — half
3. Daily attendance (30d) — line — full
4. Upcoming / live sessions — table — half
5. Recent sessions — table — half
6. Low attendance sessions — table — full

WIDGETS 1 AND 2 ARE A MATCHED PAIR OVER THE SAME DIMENSION
Both are keyed on session status; one counts sessions, the other counts attendees. Draw them on
adjacent halves with their status categories in identical order and identical bar colours, so
the eye compares the two directly. Add a shared caption beneath the pair naming any mismatch —
"Ended sessions are 62% of all sessions but 91% of all attendance." Never merge them into one
stacked chart: the two measures have different units.

"DAILY ATTENDANCE (30D)" CARRIES TWO SERIES AND THE GAP IS THE POINT
The payload has both attended and registered per day. Draw attended as a solid Accent Indigo
line and registered as a lighter line above it, and shade the area between them — that band is
the no-show gap and is the most useful thing on the widget. Caption it with the average daily
gap in learners and as a percentage. Never draw only one series.

SESSION STATUS VALUES COME FROM THE DATA
Status bars and table cells render whatever statuses the payload contains, in the payload's own
order. Tint only what is unambiguous — anything reading "live" in Success, "cancelled" in
Danger, "scheduled" in Warning — and leave the rest neutral. Never assume a four-status set,
never draw a status the payload omitted as a zero bar.

LOW ATTENDANCE MEANS BELOW 50% — STATE THE RULE
The low-attendance widget and its alert both use the same threshold: ended sessions whose
attendance rate fell below 50%. Print that rule as a Muted Ink caption on the widget rather than
leaving "low" undefined.

THE TWO ALERT RULES — exactly these, no others
low-attendance (warning; fires when N or more ended sessions fall below 50% attendance) ·
upcoming-live (info). This section cannot produce a critical — never design a Danger strip here.

DATA REALISM FOR THIS SECTION
Session titles like "Week 6 — Position sizing live", "Office hours — risk desk", "Onboarding
walkthrough — August intake". Counts like 84 sessions, 2 live now, 6 upcoming, 1,842 attended,
2,914 registered. Rates like 63% and 68%. Durations like 48 min average and 612.4 hrs total.
```

---

## Screen 1 — `/admin/insights/live-dashboard` (the section)

```text
Screen: Insights — Live Dashboard. Route /admin/insights/live-dashboard. Desktop 1440px, admin
sidebar with "Insights" expanded and "Live Dashboard" active.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard. Title "Live Dashboard", subtitle "How much live
teaching is running, how well attended it is, and what is next." Right side: the range segmented
control rendered DISABLED with the Muted Ink caption "Live Dashboard uses fixed windows shown in
each widget title" beside it, a secondary "Customize" button, a secondary "Export" button, and a
primary "Refresh" button with a "Generated 14:38:04 · 2 minutes ago" caption directly beneath it
in Muted Ink.

MODULE TAB STRIP: Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing
Insight · Messenger Insight, with "Live Dashboard" active.

ALERT STACK — beneath the tab strip. Render two alerts from this section's two real rules, and
no critical anywhere:
  - Warning: "Low attendance sessions — 7 ended sessions fell below 50% attendance." with a
    chevron link.
  - Info: "Upcoming live classes — 6 sessions scheduled or live." with a chevron link.

KPI REGION — twelve cards in a four-column grid under three hairline sub-headers, label and
value only, no deltas or sparklines anywhere, with the value given generous vertical room so the
absence reads as deliberate:
"Sessions" — Total sessions (84), Live now (2, with the "as of 14:38:04" caption and a single
small slow-pulsing marker beside the value — the only motion on the page), Upcoming (6), Ended
sessions (76).
"Attendance" — Total attended (1,842), Registered / rostered (2,914), Attendance rate % (63%
with a 3px bar), Attendance rate % (30d) (68% with a bar).
"Watch time and recent activity" — Avg watch (min) (48), Total watch (hrs) (612.4), Sessions
(30d) (22), Attended (30d) (486).
Beneath the region, two Muted Ink captions: the fixed-window note, and "Learner-level detail
lives in Live Class Attendance."

WIDGET GRID — two-column, in the exact order from the addendum:
1. "Live sessions by status" — half — horizontal bars, one per status from the payload, counts
   in monospace, "live" tinted Success, "cancelled" tinted Danger, "scheduled" tinted Warning,
   the rest neutral.
2. "Attendance by session status" — half — the identical bar treatment over the same status
   categories in the same order and colours, counting attendees instead of sessions, positioned
   directly beside widget 1 as a matched pair, with a shared caption beneath the two naming the
   mismatch: "Ended sessions are 90% of all sessions but 97% of all attendance."
3. "Daily attendance (30d)" — full — a dual-series line chart: registered as a lighter Accent
   Indigo line, attended as a solid Accent Indigo line beneath it, and the area between them
   shaded at low opacity to make the no-show gap the visual subject. Inline legend above the
   plot. A caption beneath reads "Average daily gap 34 learners · 36% did not attend." A dashed
   line marks the 30-day mean attendance.
4. "Upcoming / live sessions" — half — a table: Session (title in Accent Indigo) | Status pill |
   Scheduled (date and time in monospace) | Registered (monospace). Six rows, with any row whose
   status is live carrying a Success left rail and a "Live now" caption, and rows ordered
   soonest first.
5. "Recent sessions" — half — a table: Session (title in Accent Indigo) | Status pill | Attended
   (monospace) | Registered (monospace) | Rate % (monospace with a 3px bar; Warning tint below
   50%) | Avg min (monospace). Six rows.
6. "Low attendance sessions" — full — a table: Session | Attended | Registered | Rate %
   (monospace with a 3px bar, all Warning-tinted). Seven rows, each with a Warning left rail, a
   Muted Ink caption above the table stating the rule — "Ended sessions whose attendance fell
   below 50%" — and a footer link "Open Live Class Attendance".

ALSO PRODUCE as separate frames:
A. Loading — alert strips as shimmer, twelve KPI shimmer cards keeping all three group headers,
   each widget frame skeletoned to its default visualization.
B. Quiet state — "Live now" at 0 with no pulsing marker at all and the caption "Nothing running
   right now", "Upcoming" at 0, and the upcoming-sessions widget in its empty state reading "No
   sessions scheduled in the next 7 days" — proving the screen reads calmly rather than broken
   when nothing is live.
C. Empty — a tenant with no live sessions at all: every KPI zero, both attendance-rate KPIs
   showing an em dash with the caption "No roster recorded", and all six widgets in their empty
   states.
D. Error — an inline Danger strip replacing the widget grid, KPIs retained.
E. Mobile 390px — module tabs scroll horizontally, the disabled range control and caption wrap,
   KPIs two-up with group headers intact, every widget full width, the paired status bars
   stacked but still captioned as a pair.
```

---

## Screen 2 — `/admin/insights/live-dashboard/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/live-dashboard/widgets/[widgetId]. The expanded view
of one widget, backed by the widget detail endpoint. Produce a full page and a full-screen
overlay variant over the section.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard / Daily attendance (30d). Title: the widget title.
Beneath it the server-supplied description as a Muted Ink sentence, and the widget id in 10px
monospace with a copy icon. Right: a full labelled visualization segmented control showing only
compatible types with the server default marked; a secondary "Copy as CSV"; a secondary
"Export"; and a primary "Open Live Class Attendance" driven by the endpoint's related links. No
range control — the window is fixed and stated in the title.

HEADLINE STRIP — from the endpoint's comparison block: the current value at 32px monospace with
its currentLabel beneath, the previous value with its previousLabel, the absolute delta, and the
percentage delta tinted Success or Warning by direction. Then the endpoint's average as its own
cell. A null comparison shows the current value alone with "No comparable previous period".

CHART PANEL — the widget at full width and about 420px tall with axis labels, a legend row that
toggles series, hover tooltips reading both series at once for the dual-series widget, a dashed
line at the endpoint's average, and a brush strip for zooming. For "Daily attendance (30d)" the
shaded no-show band is retained at this size and gains per-day labelling on hover. Beneath the
chart, the endpoint's insightNote in a Sunken Surface strip — "The attended-to-registered gap
widened from 28 to 41 learners over the last two weeks."

SPLITS — a "Split by" segmented control from the endpoint's splitOptions, redrawing the chart
with an inline legend, plus a split table for the active option: Label | Value (monospace) |
Share (percentage with a 3px bar), sorted descending. Where splitOptions is empty, one Muted Ink
line replaces the region.

UNDERLYING DATA — a Sunken Surface panel behind a "Show underlying data" toggle, expanding to
the exact normalized payload with each column's kind as a 10px monospace marker in the header,
every row, right-aligned measures, and a footer with the row count and a "Copy as CSV" button.

RELATED — a right rail at 32% with the endpoint's related array as rows: title, one-line
description, chevron, and the icon type as a small Muted Ink marker.

ALSO PRODUCE: the bar-widget variant for the two status widgets, where the chart is a full-width
bar chart and a "Compare with the paired widget" toggle overlays the other measure as a second
series on a secondary axis, with a caption explaining the two units; the table-widget variant
where the chart panel becomes the full sortable, searchable, paginated table and the
underlying-data panel is dropped; a loading skeleton; an empty variant; and a 390px mobile frame
where the related rail stacks beneath and the brush strip is dropped.
```

---

## Screen 3 — `/admin/insights/live-dashboard/now`

```text
Screen: Now. Route /admin/insights/live-dashboard/now. The operational board — what is running
this minute and what runs next. The one screen in this section an admin leaves open.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard / Now. Title "Now", subtitle "Sessions running
right now and scheduled next." Right: a secondary "Present mode" button, a secondary "Open Live
Class Attendance", and a primary "Refresh" with the staleness caption beneath it in monospace —
"Generated 14:38:04 · 2 minutes ago", turning Warning past five minutes.

STALENESS STRIP — directly beneath the header, a Sunken Surface line in Muted Ink: "This board
reads a snapshot taken when the page was generated. It does not update on its own — refresh to
see the current state." Not dismissible. It is the honest counterweight to a screen called
"Now".

LIVE REGION — the top half, given generous height because it is the reason for the screen:
When one or more sessions are live, render one Panel Surface block per live session, stacked
full width, each with: a Success status pill reading "Live", the session title at 20px/600, the
scheduled start and the elapsed time since it began in monospace ("Started 14:02 · running 36
minutes"), a large attendance figure at 32px monospace showing attended against registered with
a 6px bar beneath running the block width, the attendance rate at the bar's right end, and on
the right a "Watch" primary button plus a kebab (Open session in Live Class Attendance, Open
attendee roster, Copy session id). A single slow pulse on the status pill's dot is the only
motion.
When nothing is live, this region collapses to one calm Sunken Surface panel with a small
line-art mark, the heading "Nothing running right now", and a sentence naming the next session
and its start time — never an alarming empty state, because quiet is the normal condition.

NEXT UP — beneath the live region, a table of upcoming sessions ordered soonest first: Session
(title in Accent Indigo with its course and batch as chips beneath) | Starts (absolute time in
monospace with a relative countdown caption that is rendered as static text, not a ticking
timer) | Registered / rostered (monospace with a 3px bar against that session's own historical
turnout where known) | Expected attendance (a derived figure with a Muted Ink caption naming it
an estimate from this cohort's past rate, and an em dash where no history exists) | a kebab.
Eight rows. A hairline divider separates anything starting in the next hour from the rest, with
the near group labelled "Within the hour".

ENDED TODAY — a compact table beneath: Session | Ended (time in monospace) | Attended |
Registered / rostered | Rate % (with a 3px bar, Warning below 50%) | Avg min | a chevron. Rows
below 50% carry a Warning rail. An empty variant reads "No sessions have ended today."

ALSO PRODUCE:
A. Present mode — sidebar and top bar hidden, the live region at double scale with the session
   title at 40px and the attendance figure at 64px, "Next up" reduced to the three nearest
   sessions as large rows, and the staleness caption pinned bottom-right in monospace.
B. The all-quiet variant of the whole screen — nothing live, nothing in the next 24 hours, and
   the "Ended today" table populated, so the screen still has a subject.
C. A loading skeleton.
D. A 390px mobile frame for a host on a phone: the live block full width with its bar, then
   "Next up" as stacked cards, and nothing else.
```

---

## Screen 4 — `/admin/insights/live-dashboard/sessions`

```text
Screen: Sessions. Route /admin/insights/live-dashboard/sessions. The recent-sessions and
low-attendance widgets merged into one sortable ledger, since they are the same rows filtered
differently.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard / Sessions. Title "Sessions", subtitle "Every
session in the window, with turnout and watch time." Right: secondary "Copy as CSV", secondary
"Export", primary "Open Super Live Insights" — with a Muted Ink caption beneath the header
noting that per-session analytics and comparison live in that report.

SUMMARY BAND (unequal cells, first double width): "Sessions 84" at 32px monospace with the
caption "76 ended · 6 upcoming · 2 live" | "Attendance rate 63%" with a 3px bar | "Below 50%
turnout 7" in Warning, clickable to filter | "Average watch 48 min" | "Total watch 612.4 hrs".

FILTER BAR
Search ("Search session title"), "Status" multi-select built from the payload's own status
values, "Turnout" select (Any, Below 50%, 50–75%, Above 75%, No roster), "Watch time" select
(Any, Under 15 min, 15–45 min, Over 45 min), and a sort select (Scheduled ↓, Rate ↑, Attended ↓,
Avg min ↓). Applied chips beneath with "Clear all" and "Save as view". Saved-view tabs above the
table: "All sessions" (active), "Low turnout", "Upcoming", "Live now", "No roster", "+ New view".

TABLE — one session per row
[checkbox] | Session (title in Accent Indigo, with course and batch chips beneath) | Status pill
| Scheduled (date and time in monospace with a relative caption) | Attended (monospace) |
Registered / rostered (monospace) | Rate % (monospace with a 3px bar; Warning tint below 50%; an
em dash with the caption "No roster recorded" where the denominator is zero) | Avg min
(monospace with a 3px coverage bar against the session length where known) | a kebab (Open in
Live Class Attendance, Open in Super Live Insights, Copy session id). Rows below 50% carry a
Warning left rail; live rows carry a Success rail. Sortable on Scheduled, Rate, Attended, Avg
min; active sort = Scheduled descending. Show 12 rows spanning every status including one with
no roster and one live.

TURNOUT DISTRIBUTION — a panel beneath the table: a histogram of session attendance rates in ten
buckets across 0–100, bars in Accent Indigo with buckets below 50% tinted Warning, a dashed
vertical line at the 50% threshold labelled "Low attendance threshold", and captions beneath the
axis giving median and mean turnout in monospace. A closing caption names how many sessions sit
below the line and what share of total attendance they represent.

ALSO PRODUCE: loading skeleton; empty state "No sessions in this window"; the all-healthy variant
where no session is below 50% — the histogram shows an empty Warning zone and a Success caption
reads "Every ended session cleared 50% turnout"; and a 390px mobile frame where each session is
a card with the rate bar full width and the histogram is replaced by the median and mean
captions alone.
```

---

## Screen 5 — `/admin/insights/live-dashboard/attendance`

```text
Screen: Attendance. Route /admin/insights/live-dashboard/attendance. The dual-series daily widget
expanded — because the gap between registered and attended is the number this section exists to
surface.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard / Attendance. Title "Attendance", subtitle "Who
was rostered against who turned up, day by day." Right: secondary "Copy as CSV", secondary
"Export", primary "Open Live Class Attendance".

DENOMINATOR CAVEAT — a Sunken Surface strip beneath the header, one line in Muted Ink:
"Registered / rostered counts learners who registered plus learners rostered in by batch
membership. Attendance rate is attended divided by that figure." Not dismissible.

HEADLINE BAND (unequal cells, first double width): "Attendance rate (30d) 68%" at 32px monospace
with a 3px bar and the caption "486 attended of 714 rostered" | "No-show gap 228" in Warning
with the caption "32% did not attend" | "Average daily gap 34 learners" | "Best day 4 Aug · 84%"
in Success | "Worst day 22 Jul · 41%" in Warning.

THE GAP CHART — full width, the primary object: registered drawn as a lighter Accent Indigo line
and attended as a solid Accent Indigo line beneath, with the band between them shaded at low
opacity and labelled directly on the chart as "No-show gap". A dashed line marks the 30-day mean
attendance. Weekend columns carry a very subtle Sunken Surface backdrop. Hovering any day shows
all three figures at once — registered, attended, gap — in a monospace tooltip. Beneath the
chart, a caption naming the direction of travel: "The gap widened from 28 to 41 learners over
the last two weeks."

BENEATH — asymmetric 58/42:
LEFT: "Gap by day of week" — seven horizontal bars, one per weekday, each showing that weekday's
average no-show rate as a percentage with a 3px bar, ordered Monday to Sunday rather than by
value so the weekly shape is legible, with a caption naming the worst weekday.
RIGHT: two stacked panels —
1. "Where the gap concentrates" — a ranked list of the five sessions with the largest absolute
   no-show counts: session title, rostered, attended, gap in monospace, and a chevron.
2. "Rate against volume" — a small scatter with rostered on the x-axis and attendance rate on
   the y-axis, one point per session, a dashed horizontal line at the 50% threshold, and a
   caption on whether larger sessions attend worse.

DAILY TABLE — beneath: Date (monospace) | Registered / rostered | Attended | Gap (monospace,
Warning-tinted) | Rate % (with a 3px bar) | Sessions held (monospace) | a chevron to that day in
Live Class Attendance. Thirty rows, most recent first, days with no sessions rendered at reduced
emphasis with em dashes rather than zeros.

ALSO PRODUCE: the empty state where no attendance is recorded — the chart replaced by a line-art
mark with "No attendance recorded in this window" and the caveat strip retained; a loading
skeleton; and a 390px mobile frame where the scatter is dropped with a caption saying it needs a
wider screen, and the daily table becomes stacked cards.
```

---

## Screen 6 — `/admin/insights/live-dashboard/alerts`

```text
Screen: Alerts. Route /admin/insights/live-dashboard/alerts. Scoped to this section's two rules.

HEADER
Breadcrumb: Admin / Insights / Live Dashboard / Alerts. Title "Alerts", subtitle "What Live
Dashboard is flagging, and the thresholds behind it." Right: secondary "Export CSV", secondary
"View all insight alerts", primary "Mark all as seen".

SUMMARY BAND (unequal cells, first double width): "Open alerts 2" at 32px monospace with the
caption "1 warning · 1 info" and a two-segment composition bar | "New since yesterday 1" |
"Resolved this week 2" in Success | "Muted 0" | "Rules 2" with the caption "both thresholds
configurable". No critical cell anywhere — this section cannot produce one, and the band must
not reserve space for it.

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN: full-width strips matching the section's own alert rendering exactly, grouped
under hairline severity headers with counts, warning first. Each strip: severity-tinted
background, title at 15px/600, message beneath, and on the right a first-seen timestamp in
monospace, a chevron where an href exists, and a kebab (Open the linked page, Mute for 1 day,
Mute for 7 days, Mute forever, Mark as resolved, Copy alert id) — the three mute durations
matching the real enum. Show the two alerts from Screen 1.

TAB 2 — RESOLVED: a dense table: Alert (title with message truncated beneath) | Severity pill |
Rule id in 10px monospace | First seen | Resolved (relative + absolute) | Resolved by (a name, or
"Automatically" in Muted Ink where the condition simply cleared) | Duration open (monospace) |
kebab. Five rows, several resolved automatically as sessions ended.

TAB 3 — MUTED: the same table plus "Muted until" in Warning with "Forever" as a plain word, an
"Unmute" text button per row, and a caption explaining that muting hides the alert but does not
change the condition. An empty variant reads "No muted rules in Live Dashboard."

TAB 4 — RULES: one Panel Surface block per rule, both and no more:
  - "Low attendance sessions" — a "Severity it can produce" chip row showing Warning only — the
    condition stated plainly ("Raise a warning when N or more ended sessions fall below 50%
    attendance"), a numeric threshold control with a live caption showing what the current data
    would produce at that threshold, a note that the 50% floor is fixed and not configurable, an
    enabled toggle, and a last-fired caption.
  - "Upcoming live classes" — Info only — the condition, a numeric threshold control, an enabled
    toggle, and a caption noting this rule is informational and clears itself once sessions end.

ALSO PRODUCE: the all-clear empty state for Open — line-art level line, "Nothing is flagged in
Live Dashboard", the sentence "Alerts appear here when one of the two rules fires.", secondary
"View rules"; the mute-confirmation modal naming the rule and duration; a loading skeleton; and a
390px mobile frame.
```

---

## Not duplicated here

Four screens are structurally identical to ones already specified — build once, scope by slug:

- **Customize** (`/admin/insights/live-dashboard/customize`) — same layout editor as
  [School Vitals Screen 6](./stitch-school-vitals-prompts.md), with this section's twelve KPIs in
  three groups and six widgets, and no delta-related controls since this section has none. One
  section-specific rule worth carrying: the two status widgets are a matched pair, so the editor
  should warn when one is hidden and the other is not.
- **Digests** (`/admin/insights/live-dashboard/digests`) — same as School Vitals Screen 7, with
  the range selector omitted and a section-specific caption noting that "Live now" in an emailed
  digest is the value at send time and will be stale on arrival.
- **Widget library** (`/admin/insights/live-dashboard/library`) — the tenant-wide catalogue with
  this section preselected.
- **Settings** (`/admin/insights/live-dashboard/settings`) — tenant-wide; Live Dashboard is one
  row in its access table.

---

## Backend gaps these prompts assume

| Prompt feature                                                                            | Status                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Section endpoint returning the twelve KPIs and six widgets, exact titles and order        | exists                                                                                                                                         |
| Session counts by state (total, live now, upcoming, ended) and by status breakdown        | exists                                                                                                                                         |
| Attendance totals, both attendance rates, average and total watch time                    | exists                                                                                                                                         |
| Daily attendance with both attended and registered series                                 | exists                                                                                                                                         |
| Upcoming/live, recent, and low-attendance session tables                                  | exists                                                                                                                                         |
| The two live-dashboard alert rules with a configurable count threshold                    | exists                                                                                                                                         |
| Alert mute (1d / 7d / forever), resolve, persisted alert state                            | exists                                                                                                                                         |
| Saved layout, widget detail endpoint, library, settings, digests per slug                 | exist                                                                                                                                          |
| **Range support for this section**                                                        | **missing** — `buildLiveDashboardWidgets` takes no range, which is why the addendum disables the control rather than faking it                 |
| **Deltas and sparklines on Live Dashboard KPIs**                                          | **missing** — no `deltaPct`, `deltaAbs`, or `sparkline` on any widget in this builder                                                          |
| **A realtime channel behind "Live now"**                                                  | **missing** — the value is a snapshot at `generatedAt`, which is why the addendum bans live-looking treatment and mandates a staleness caption |
| Elapsed-since-start per live session, and per-session attendance while running (Screen 3) | needs backend — the upcoming payload carries title, status, scheduled time, and registered count only                                          |
| Expected-attendance estimate from a cohort's historical rate (Screen 3)                   | needs backend                                                                                                                                  |
| Gap by weekday, gap concentration by session, rate-against-volume scatter (Screen 5)      | derivable from the daily series and session list, but not returned pre-computed                                                                |
| Sessions ended today as its own slice (Screen 3)                                          | needs backend or a client-side filter over recent sessions                                                                                     |
| Saved views on the sessions ledger                                                        | needs backend                                                                                                                                  |

One correctness note carried into the addendum: attendance rate is computed against
"Registered / rostered", which includes batch-rostered learners who never registered themselves.
That makes this section's rate structurally comparable to the Live Class Attendance report but
**not** to Super Live Insights, whose denominator is all attendance records including the
unresolved "registered" bucket. If the two are ever shown side by side, label the denominators
explicitly rather than letting the numbers appear to disagree.
