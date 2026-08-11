# Google Stitch Prompts — School Vitals (`/admin/insights/school-vitals`)

Paste **Block 0 (Design System)**, then **Block 0-ID (Insights module addendum)**, then
**Block 0-SV (School Vitals addendum)**, then one screen prompt per generation. Keep everything
in one Stitch project.

Block 0 and Block 0-ID are unchanged from
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) — if you are
already in that Stitch project, skip straight to Block 0-SV. Block 0-SV is reproduced in full
below along with a short recap of what has changed in the backend since the Dashboard prompts
were written.

Source of truth:

- `backend/apps/api/src/server/insights/insights.service.ts`
  (`buildSchoolVitalsWidgets`, `schoolVitalsAlertMetrics`, `ROLLUP_KPI_DEFS`,
  `FUNNEL_STAGE_LABELS`)
- `backend/apps/api/src/server/insights/insights-alerts.ts` (the five school-vitals rules)
- `backend/apps/api/src/server/insights/insights.schemas.ts` (widget, layout, alert, and widget
  detail contracts)
- `backend/apps/api/src/app/api/v1/insights/[slug]/{alerts,digests,layout,library,settings,widgets}`
- `frontend/apps/web/src/features/admin/insights/*`

**What changed since the Dashboard prompts.** The insights backend has moved on, and these
prompts assume the newer contract: the dashboard endpoint now takes a `range` of `12m`, `30d`,
or `ytd` and returns `generatedAt` plus a `layout`; widgets now carry `deltaPct`, `deltaAbs`,
`sparkline`, `href`, and `footnote`; and there are real per-slug subroutes for alerts, digests,
layout, library, settings, and widget detail. The widget detail endpoint returns a description,
a comparison block, an average, an insight note, split options with their data, related links,
and a failure-rate block. Design against that contract, not the older one.

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
- Success            #15803D / #62DF7D   — healthy, growth, resolved
- Warning            #B45309 / #E6C364   — needs attention, pending, degraded
- Danger             #DC2626 / #FF8A80   — critical, failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, counts, IDs, timestamps: JetBrains Mono.
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
- Every action that sends data outside the console or changes what others see opens a
  confirmation naming exactly what happens, in plain words.

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

## Block 0-ID — Insights module addendum (paste second)

```text
INSIGHTS DASHBOARD MODULE ADDENDUM — applies to every screen in /admin/insights/*

WHAT THIS MODULE IS
A widget-driven dashboard system, not a report. The server returns a dashboard object per slug
carrying a title, a currency, a range, a generatedAt timestamp, an alerts array, a widgets
array, and a saved layout. Each widget carries an id, a title, a default visualization, a span,
a normalized data payload, and optionally a deltaPct, a deltaAbs, a sparkline series, an href,
and a footnote. The client chooses how to draw it and remembers that choice. Design every screen
as a renderer of that contract — nothing here is hand-placed, and any widget must survive being
moved, resized, hidden, or redrawn as a different chart type.

THE SIX INSIGHT SECTIONS (real slugs — this is the module's own nav)
dashboard · school-vitals · sales-insight · live-dashboard · marketing-insight ·
messenger-insight.
Render them as the module tab strip on every screen. Never invent a seventh.

RANGE
The real range enum is exactly three values: 12m, 30d, ytd. Render it as a segmented control
labelled "Last 12 months / Last 30 days / Year to date". Where a widget's own window is fixed by
its query — anything titled "(30d)" — keep that suffix in the title and add a Muted Ink footnote
on the widget saying the window is fixed, so a range change that does not move it is never read
as a bug.

THE WIDGET FRAME — one component, used everywhere
Every widget is a Panel Surface block with a consistent frame: the title at 14px/600 on the
left; on the right a compact visualization switcher and a kebab. The switcher shows only the
visualization types that the widget's data actually supports — a single-value payload offers
KPI and table and nothing else; a time series offers line, area, bar, combo, and table. Never
show an incompatible option greyed out; omit it. The chosen type is remembered per widget, so
mark the active option clearly and add a small "Default" caption beside the type the server
suggested. Where the widget carries an href, its title is a link. Where it carries a footnote,
that renders as a Muted Ink caption pinned to the bottom of the frame.
The kebab holds: Expand, Change visualization, View underlying data, Copy as CSV, Export,
Refresh this widget, Hide from this dashboard.
Widget spans are exactly three: full, half, third. Honour them.

THE VISUALIZATION SET (real enum, exactly these fourteen)
kpi · table · pivot · line · area · bar · combo · pie · donut · funnel · progress · scatter ·
heatmap · sparkline.
Pie and donut exist and must appear in the switcher when the data supports them, but they are
never a default. Defaults are kpi for single values, line for time series, area for cumulative
or volume series, bar for categorical comparison, funnel for stage sequences, table for detail.

KPI WIDGETS
A KPI widget shows the label at 12px/600 uppercase Muted Ink, the value at 28px monospace with
its unit or currency code at 60% size, a delta caption built from deltaPct and deltaAbs in plain
words ("+412 · +8.4% vs the previous 30 days"), and a sparkline along the bottom edge where the
widget carries one. Currency values use the dashboard's currency field and always show the code.
A KPI with a null delta shows no delta caption rather than a zero.

ALERTS ARE PART OF THE CONTRACT, NOT DECORATION
Alerts carry a severity of info, warning, or critical, a title, a message, and an optional href.
Render them as a stack of full-width strips above the widgets — Danger tint for critical,
Warning for warning, Sunken Surface for info — title in 600 weight, message beneath, a chevron
where an href exists and no affordance at all where it does not. Never a toast, never
auto-dismissed, never an invented severity.

EMPTY WIDGETS ARE NORMAL
A widget with zero rows renders inside its own frame with a small line-art mark and one sentence
naming why it is empty in that widget's own terms, plus a link to the relevant report where one
exists. Never blank the frame, never collapse the widget out of the layout.

DATA REALISM
Currency in the dashboard's currency with the code shown: 1,84,600.00 INR. Course titles like
"Funded Trader Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp". Learner names like
"Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo". Counts like 42, 218, 3,412, 12,840.
```

---

## Block 0-SV — School Vitals addendum (paste third)

```text
SCHOOL VITALS SECTION ADDENDUM — applies to every screen under /admin/insights/school-vitals

WHAT THIS SECTION ANSWERS
Is the academy healthy? Not "how much did we earn" — that is Sales Insight — but whether
learners are showing up, moving through content, passing assessments, and whether anything is
rotting quietly. It is the operator's morning check, so it must be scannable in ten seconds and
drillable in three clicks.

THE FOURTEEN KPIs — exactly these, in exactly this order, all span third
Population and reach, first six: Learners · Active enrollments · Current MAU · Active users
(30d) · Inactive learners (30d+) · Assessment pass rate %.
Then the eight learning rollups: Lessons completed · Assessments submitted · Assessments
passed · Practice sessions · Certificates issued · Community posts · Path steps completed ·
Moderation cases opened.
Group them visually under two hairline sub-headers — "Population" and "Learning activity (30d)"
— rather than running fourteen identical cards in an undifferentiated wall. Two KPIs invert the
usual reading and must be captioned so nobody misreads them: "Inactive learners (30d+)" is bad
when it rises, and "Moderation cases opened" is bad when it rises. Give both a Warning tint on
an upward delta and Success on a downward one, and state the inversion in a caption on each.
"Assessment pass rate %" is a percentage, not a count — render it with a trailing % and a 3px
bar, never as a bare integer.

THE SEVEN WIDGETS — exactly these titles, in exactly this order
1. Learning activity (30d) — line — full
2. Lessons completed (30d) — line — half
3. Assessments submitted (30d) — line — half
4. Daily active users (30d) — area — full
5. Learning engagement funnel (30d) — funnel — half
6. Content health — table — half
7. Top courses by learning (30d) — table — full

THE FUNNEL IS NOT A CONVERSION FUNNEL — SAY SO
The engagement funnel's six stages are Lessons completed · Assessments submitted · Assessments
passed · Practice sessions · Certificates issued · Community posts. These are event counts over
30 days, not a cohort walking through steps — a learner can appear in several stages or skip
some entirely, and later stages are not subsets of earlier ones. Render it as a horizontal
funnel of descending bars, but carry a mandatory Muted Ink caption beneath: "Event counts over
30 days, not a single cohort. Stages are independent and may overlap." Never draw
stage-to-stage conversion percentages between the bars, because they would be arithmetic
nonsense. Show each stage's own count and its share of total events instead.

CONTENT HEALTH IS FOUR SIGNALS, NOT A SCORE
The Content health widget holds exactly four rows: Dormant courses (30d) · Inactive learners
(30d+) · Open moderation cases · Upcoming live sessions. Never roll them into a single health
score or letter grade. Render each row with its count in monospace, a plain one-line consequence
("42.8 GB of storage held", "still counted in your learner total"), and a chevron link to the
report that holds the detail — Resource Usage for the first two, the moderation queue for the
third, Live Class Attendance for the fourth. The first three are Warning-tinted when non-zero;
"Upcoming live sessions" is neutral information and must never be tinted as a problem.

THE FIVE ALERT RULES — exactly these, no others
no-learning-activity (info) · inactive-learners (warning above threshold, otherwise info) ·
dormant-courses (info) · open-moderation (warning above threshold, otherwise info) ·
low-pass-rate (warning).
Never invent a critical alert for this section — none of its rules can produce one, and a
Danger strip here would be a lie.

TOP COURSES COLUMNS — exactly these four
Course · Lesson completions · Active learners · Avg progress %. The last is a percentage with a
3px bar; the middle two are monospace counts.

DATA REALISM FOR THIS SECTION
Pass rates like 74.8%, 61.2%. Rollup counts like 12,840 lessons, 3,412 assessments, 218
certificates. Inactive learners like 412. Dormant courses like 18. Moderation cases like 9.
```

---

## Screen 1 — `/admin/insights/school-vitals` (the section)

```text
Screen: Insights — School Vitals. Route /admin/insights/school-vitals. Desktop 1440px, admin
sidebar with "Insights" expanded and "School Vitals" active.

HEADER
Breadcrumb: Admin / Insights / School Vitals. Title "School Vitals", subtitle "Whether learners
are showing up, moving through content, and passing." Right side: the range segmented control
(Last 12 months / Last 30 days / Year to date) with "Last 30 days" selected, a secondary
"Customize" button, a secondary "Export" button, and a primary "Refresh" button with a
"Generated 4 minutes ago" caption beneath it in Muted Ink.

MODULE TAB STRIP: Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing
Insight · Messenger Insight, with "School Vitals" active.

ALERT STACK — beneath the tab strip. Render four alerts drawn only from this section's five real
rules, proving both severities it can produce and both href states:
  - Warning: "Inactive learners — 412 learners have had no activity for 30 days or more." with a
    chevron link.
  - Warning: "Low assessment pass rate — 61.2% of submitted assessments passed, below your 70%
    threshold." with a chevron link.
  - Info: "Dormant courses — 18 courses have had no learner activity in 30 days." with a chevron.
  - Info: "No learning activity — 3 days in the last 30 recorded no learning events at all."
    with no link and no clickable affordance.
No critical strip anywhere on this screen.

KPI REGION — fourteen KPI cards in a four-column grid, split into two labelled groups by
hairline sub-headers:
"Population" — Learners (12,840, sparkline, +412 delta), Active enrollments (3,412, delta),
Current MAU (2,986, sparkline), Active users (30d) (3,148, delta), Inactive learners (30d+)
(412, Warning-tinted upward delta and the inversion caption "Higher is worse"), Assessment pass
rate % (61.2% with a trailing percent, a 3px bar, and a Warning delta).
"Learning activity (30d)" — Lessons completed (12,840), Assessments submitted (3,412),
Assessments passed (2,088), Practice sessions (1,204), Certificates issued (218), Community
posts (486), Path steps completed (942), Moderation cases opened (9, Warning-tinted upward delta
with the inversion caption).
Each card carries the compact switcher on hover offering only KPI and Table. Show three cards
with no delta at all to prove the null-delta variant.

WIDGET GRID — a two-column grid beneath the KPIs, in the exact order from the addendum:
1. "Learning activity (30d)" — full — a line chart of total learning events per day over 30
   days, Accent Indigo, with a dashed average line, a footnote reading "Window fixed at 30
   days", and a caption naming the busiest and quietest day.
2. "Lessons completed (30d)" — half — a line chart, single series, with its own average line.
3. "Assessments submitted (30d)" — half — a line chart, single series, visually paired with the
   one beside it so the two read as a matched pair rather than two unrelated charts.
4. "Daily active users (30d)" — full — an area chart, Accent Indigo at low opacity with a solid
   top stroke, a dashed line at the 30-day mean, weekday and weekend shading kept subtle, and a
   caption naming the peak day and the weekday-versus-weekend gap.
5. "Learning engagement funnel (30d)" — half — a horizontal funnel: one descending bar per stage
   in the order Lessons completed, Assessments submitted, Assessments passed, Practice sessions,
   Certificates issued, Community posts, each labelled with its count in monospace and its share
   of total events. The mandatory caption from the addendum sits beneath. No inter-stage
   conversion percentages anywhere.
6. "Content health" — half — the four-signal table per the addendum: Signal | Count (monospace)
   | a one-line consequence in Muted Ink | chevron. Dormant courses, Inactive learners, and Open
   moderation cases Warning-tinted; Upcoming live sessions neutral.
7. "Top courses by learning (30d)" — full — a table: Course (title in Accent Indigo) | Lesson
   completions (monospace, right-aligned, with a 3px share bar) | Active learners (monospace) |
   Avg progress % (percentage with a 3px bar). Eight rows, leader tinted Accent Wash.

ALSO PRODUCE as separate frames:
A. Loading — alert strips as shimmer, the fourteen KPI cards as shimmer blocks keeping both
   group headers visible, each widget frame skeletoned to its default visualization.
B. Empty — the same layout where "Learning activity (30d)", the funnel, and "Top courses" are in
   their empty states ("No learning events recorded in this window") while the KPIs still show
   zeros, so the difference between a zero KPI and an empty chart is visible in one frame.
C. No alerts — the stack absent with no reserved space.
D. Error — an inline Danger strip replacing the widget grid, KPIs retained.
E. Mobile 390px — module tabs scroll horizontally, KPIs two-up with their group headers intact,
   every widget full width in source order, the funnel bars stacking with counts beside them.
```

---

## Screen 2 — `/admin/insights/school-vitals/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/school-vitals/widgets/[widgetId]. The expanded view
of one widget, backed by the widget detail endpoint. Produce a full page and a full-screen
overlay variant over the section.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Daily active users (30d). Title: the widget title.
Beneath it, the server-supplied description as a Muted Ink sentence, and the widget id in 10px
monospace with a copy icon. Right: a full labelled visualization segmented control showing only
compatible types with the server default marked; the range segmented control; a secondary "Copy
as CSV"; a secondary "Export"; and a primary "Open the full report" that uses the widget's own
related links.

HEADLINE STRIP — built from the endpoint's comparison block, unequal cells: the current value at
32px monospace with its currentLabel beneath ("Last 30 days"), then the previous value with its
previousLabel ("Previous 30 days"), then the absolute delta, then the percentage delta with a
Success or Warning tint by direction — and, where the widget is one of the inverted ones, the
tint flipped with a caption saying so. Then the average as its own cell. A null comparison
renders the strip with the current value alone and the caption "No comparable previous period"
rather than zeros.

CHART PANEL — the widget at full width and about 420px tall with the affordances the small frame
cannot afford: axis labels, a legend row that toggles series, hover tooltips, a dashed line at
the endpoint's `average`, and a brush strip for zooming a sub-range. Beneath the chart, the
endpoint's `insightNote` rendered as a plain-language observation in a Sunken Surface strip —
"Daily active users fell 18% on weekends across this window."

SPLITS — a "Split by" segmented control built from the endpoint's `splitOptions`, redrawing the
chart with an inline legend. Beneath it, the split table for the active option: Label | Value
(monospace) | Share (percentage with a 3px bar), sorted descending. Where `splitOptions` is
empty, this whole region is replaced by a single Muted Ink line reading "This widget has no
further breakdown."

UNDERLYING DATA — a Sunken Surface panel collapsed behind a "Show underlying data" toggle,
expanding to the exact normalized payload: one column per normalized column with its kind as a
10px monospace marker in the header (dimension, measure, string, number, date), every row,
right-aligned measures, a footer with the row count and a "Copy as CSV" text button.

RELATED — a right rail at 32% holding the endpoint's `related` array as rows: title, one-line
description, and a chevron, each row carrying its icon type as a small Muted Ink marker rather
than a decorative glyph.

ALSO PRODUCE: the funnel-widget variant of this screen, where the chart panel is the six-stage
funnel at full width with per-stage counts and shares, the addendum's caption pinned beneath,
and the splits region replaced by a per-stage table; the table-widget variant, where the chart
panel becomes the full sortable, searchable, paginated table and the underlying-data panel is
omitted as redundant; a loading skeleton; an empty variant; and a 390px mobile frame where the
related rail stacks beneath and the brush strip is dropped.
```

---

## Screen 3 — `/admin/insights/school-vitals/funnel`

```text
Screen: Engagement funnel. Route /admin/insights/school-vitals/funnel. The full-page treatment of
the six-stage learning engagement funnel — the one widget whose shape rewards a dedicated screen.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Engagement funnel. Title "Learning engagement
funnel", subtitle "Six learning event types over the selected window." Right: the range
segmented control, a secondary "Copy as CSV", a secondary "Export", and a primary "Open Progress
& Score" linking to the report that holds the learner-level detail.

MANDATORY CAVEAT STRIP — directly beneath the header, before any chart: a Sunken Surface strip,
one line, in Muted Ink: "These are event counts over the window, not a single cohort moving
through steps. A learner can appear in several stages, and later stages are not subsets of
earlier ones." This strip is not dismissible and appears on every state of this screen.

FUNNEL PANEL — full width, the primary object: six horizontal bars in the fixed stage order —
Lessons completed, Assessments submitted, Assessments passed, Practice sessions, Certificates
issued, Community posts — each bar labelled on the left with its stage name, filled proportional
to its count in graded tints of Accent Indigo with the largest stage in the full accent, and on
the right its count in 20px monospace with its share of total events beneath. No connecting
arrows, no inter-stage percentages, no tapering trapezoid shape that implies flow.

BENEATH THE FUNNEL — asymmetric 58/42:
LEFT: "Stage trends" — one small multiple per stage in a three-column grid, each a slim line
chart of that stage's daily count over the window with its stage name above and its total on the
right, so an admin can see which stage moved. A caption names the stage that grew and fell most.
RIGHT: two stacked panels —
1. "Stage detail" — a table: Stage | Events (monospace) | Share (percentage with a 3px bar) |
   Change vs previous window (signed monospace with a percentage beneath, Success or Warning by
   direction) | a chevron to the report behind that stage — Progress & Score for the assessment
   stages, the certificates report for certificates, the community report for posts.
2. "Ratios worth watching" — a deliberately small set of ratios that ARE arithmetically valid
   because both terms are assessment events: pass rate (assessments passed ÷ assessments
   submitted) and certificates per pass, each as a percentage with a 3px bar and a plain caption.
   A closing Muted Ink line states why other stage-to-stage ratios are not shown.

ALSO PRODUCE: a comparison state where a second window is overlaid — each funnel bar gains a
thin Muted Ink outline marker at the previous window's value with a delta caption; the empty
state where every stage is zero, showing the bars as hollow tracks with the sentence "No learning
events recorded in this window" and a link to check whether tracking is configured; a loading
skeleton; and a 390px mobile frame where the small multiples become a single column and the
stage-detail table becomes stacked cards.
```

---

## Screen 4 — `/admin/insights/school-vitals/content-health`

```text
Screen: Content health. Route /admin/insights/school-vitals/content-health. The four signals from
the widget, given room to be acted on.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Content health. Title "Content health", subtitle
"Four signals that quietly degrade an academy, and where to fix each." Right: the range
segmented control, a secondary "Export", and a primary "Refresh".

NO SCORE — a Muted Ink line directly beneath the header: "These four signals are reported
separately and deliberately not combined into a single score."

SIGNAL BLOCKS — four full-width Panel Surface blocks, one per signal, in the widget's own order.
Each block is laid out the same way so they read as a set:
LEFT — the figure: the count at 32px monospace with the signal name above it in 12px/600
uppercase Muted Ink, a delta caption against the previous window, and a 12-period sparkline
along the bottom edge.
MIDDLE — the consequence in one or two plain sentences, plus a small evidence row of monospace
chips.
RIGHT — the action: a primary button linking to the report that resolves it, plus a secondary
where a second path exists.
The four blocks:
1. "Dormant courses (30d)" — 18 — Warning figure — "These courses have had no learner activity
   for 30 days and hold 42.8 GB of storage." — chips "42.8 GB", "218 lessons", "11 unpublished"
   — actions "Review in Resource Usage" primary, "Archive candidates" secondary.
2. "Inactive learners (30d+)" — 412 — Warning figure — "Still counted in your learner total and
   in MAU denominators, but not learning." — chips "84 never active", "96 have paid", "1,204
   enrolments held" — actions "Review in Resource Usage" primary, "Message them" secondary.
3. "Open moderation cases" — 9 — Warning figure — "Community reports waiting on a decision. The
   oldest has been open for 6 days." — chips "3 over 72 hours", "2 escalated" — actions "Open
   the moderation queue" primary.
4. "Upcoming live sessions" — 3 — neutral figure, no tint — "Scheduled or currently live in the
   next 7 days." — chips "1 live now", "186 registered" — actions "Open Live Class Attendance"
   primary. A caption states this signal is informational and not a problem.

TREND PANEL — beneath the blocks, full width: one line per signal over the last 12 periods on a
shared normalised axis, with an inline legend that toggles series and a caption naming which
signal is worsening fastest. The upcoming-live series is drawn in Muted Ink so it never visually
competes with the three that matter.

ALSO PRODUCE: the all-clear state where all three problem signals are zero — each block collapses
to a single line with a Success marker and the sentence "Nothing dormant", "No inactive
learners", "No open cases", while the upcoming-live block stays full size; a loading skeleton;
and a 390px mobile frame where each block stacks its three regions vertically with the action
button full width.
```

---

## Screen 5 — `/admin/insights/school-vitals/alerts`

```text
Screen: Alerts. Route /admin/insights/school-vitals/alerts. Scoped to this section's five rules.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Alerts. Title "Alerts", subtitle "What School
Vitals is flagging, and the thresholds behind it." Right: secondary "Export CSV", secondary
"View all insight alerts" linking to the cross-section view, primary "Mark all as seen".

SUMMARY BAND (unequal cells, first double width): "Open alerts 4" at 32px monospace with the
caption "2 warning · 2 info" and a two-segment composition bar | "New since yesterday 1" |
"Resolved this week 3" in Success | "Muted 1" in Muted Ink with the rule name beneath | "Rules 5"
with the caption "all thresholds configurable". No critical cell anywhere — this section cannot
produce one, and the band must not reserve space for it.

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN: full-width strips matching the section's own alert rendering exactly, grouped
under hairline severity headers with counts, warnings first. Each strip: severity-tinted
background, title at 15px/600, the message beneath, and on the right a first-seen timestamp in
monospace, a chevron where an href exists, and a kebab (Open the linked page, Mute for 1 day,
Mute for 7 days, Mute forever, Mark as resolved, Copy alert id) — the three mute durations
matching the real mute enum exactly. Show the four alerts from Screen 1.

TAB 2 — RESOLVED: a dense table: Alert (title with the message truncated beneath) | Severity
pill | Rule id in 10px monospace | First seen | Resolved (relative + absolute) | Resolved by (a
name, or "Automatically" in Muted Ink where the condition simply cleared) | Duration open
(monospace) | kebab. Six rows.

TAB 3 — MUTED: the same table plus "Muted until" in Warning — with "Forever" rendered as a plain
word rather than a date — and an "Unmute" text button per row, under a caption explaining that
muting hides the alert but does not change the condition.

TAB 4 — RULES: one Panel Surface block per rule, all five and no more:
  - "No learning activity" — info — condition stated plainly, a threshold control for the number
    of empty days, an enabled toggle, a last-fired caption.
  - "Inactive learners" — warning above threshold, info below — a numeric threshold control with
    a live caption showing what the current data would produce.
  - "Dormant courses" — info — threshold control.
  - "Open moderation" — warning above threshold, info below — threshold control.
  - "Low assessment pass rate" — warning — a percentage threshold control with a caption naming
    the current rate against it.
Each block carries a "Severity it can produce" chip row that shows only the severities that rule
can actually emit, so nobody expects a critical.

ALSO PRODUCE: the all-clear empty state for Open — line-art level line, "Nothing is flagged in
School Vitals", the sentence "Alerts appear here when one of the five rules fires.", secondary
"View rules"; the mute-confirmation modal naming the rule, duration, and what stops appearing; a
loading skeleton; and a 390px mobile frame.
```

---

## Screen 6 — `/admin/insights/school-vitals/customize`

```text
Screen: Customize School Vitals. Route /admin/insights/school-vitals/customize. The layout editor
scoped to this section, backed by the saved layout contract — per-widget hidden flag, span, viz,
and order, plus a density and a sharing mode.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Customize. Title "Customize", subtitle "Choose
which widgets appear in School Vitals, their size, and how each is drawn." Right: secondary
"Reset to default layout", secondary "Preview", primary "Save layout" — disabled until something
changes, with an unsaved-changes caption in Warning when dirty.

LAYOUT — asymmetric 68/32.
LEFT — the canvas: the section rendered at reduced fidelity, each widget a Panel Surface block
showing its title, a visualization-type chip, and a span chip, sized to its real span in a
two-column grid. A drag handle on the left edge; on hover a control row with a span segmented
control (Third / Half / Full), a visualization select showing only compatible types, and a
hide toggle rendered as an eye control rather than a delete x — because the contract hides
widgets rather than removing them, and a hidden widget must be recoverable in place. Hidden
widgets stay in the canvas at 40% opacity with a "Hidden" chip and a "Show" text button, grouped
beneath a hairline "Hidden (2)" header at the end.
The KPI region sits at the top as its own bounded area with both group sub-headers preserved and
a caption "KPIs always render first"; the fourteen KPI cards can be reordered and hidden within
it but not dragged into the widget grid.
A dashed "Add widget" tile at the end of the grid opens the section-scoped library.

RIGHT — three stacked panels:
1. "Layout" — label/value summary: widgets shown, widgets hidden, KPIs shown, and a "Density"
   segmented control (Comfortable / Compact) matching the real enum, with a caption on what it
   changes.
2. "Defaults" — the one-sentence visualization default rule, plus a "Reset every widget to its
   server default" text button, and a caption noting that the fixed-window widgets keep their
   "(30d)" titles regardless of the range control.
3. "Sharing" — a radio matching the real enum exactly: "Only me" (private) / "Everyone with
   access to School Vitals" (tenant), with a caption naming how many admins a tenant-shared
   layout affects and a note that it replaces their default rather than locking them out of
   customizing.

ALSO PRODUCE: the preview state — customize chrome hidden, the section rendered from the pending
layout, a fixed bottom bar reading "Previewing unsaved layout" with "Discard" and "Save layout";
the reset-confirmation modal naming how many widgets return and what personal visualization
choices are cleared; a loading skeleton; and a 390px mobile frame where the canvas is a
reorderable single-column list with up and down controls instead of drag.
```

---

## Screen 7 — `/admin/insights/school-vitals/digests`

```text
Screen: School Vitals digests. Route /admin/insights/school-vitals/digests. Scheduled email
snapshots of this section.

HEADER
Breadcrumb: Admin / Insights / School Vitals / Digests. Title "Digests", subtitle "Email a
snapshot of School Vitals on a schedule." Right: secondary "Send a test to myself", primary "New
digest".

SUMMARY BAND (unequal cells, first double width): "Digests 3" at 32px monospace with "2 enabled ·
1 paused" | "Sends this month 12" with "12 delivered" | "Recipients 8" with "2 outside your
domain" in Warning | "Next send in 14 hours" with the digest name beneath | "Failing 0" in
Success.

LIST — one Panel Surface block per digest:
LEFT — identity: the digest name at 15px/600, a "School Vitals" section chip, a cadence line in
monospace ("Every Monday, 08:00 Asia/Kolkata"), a range chip matching the real enum ("Last 30
days"), and a contents caption ("14 KPIs, 4 widgets, alerts included").
RIGHT — delivery: recipient chips with any address outside the tenant's own email domains
carrying a Warning marker, a last-sent line with a status pill, a 30-day strip of one square per
send tinted by outcome, an enabled toggle, and a kebab (Edit, Send now, Duplicate, View send
history, Pause, Delete).
Show 3 blocks including one paused at reduced emphasis.

NEW DIGEST DRAWER: a name field; the section fixed to School Vitals and shown as a read-only
chip; a range select matching the three real values; a "Contents" block with "Include alerts"
(on), "Include KPIs" (on) with a sub-checklist of the two KPI groups, and a widget checklist
mirroring the section's own order with a running caption "4 of 7 widgets selected"; a "Format"
radio (Inline email with charts as images / Inline email plus a CSV attachment / Link to the
live section only) with a trade-off caption under each; a recipients chips input with the
outside-domain warning; cadence, time, and timezone; and a footer with "Send a test" secondary
and "Create digest" primary.

EMAIL PREVIEW — one frame of what lands in an inbox: a 640px body on Page Canvas with the
academy name, "School Vitals", the range label, the alert strips at the top in the same severity
treatment, the KPIs as a two-column label/value list under their two group headings rather than
as cards, each included widget as a static chart image with its title above, the funnel's
mandatory caveat caption carried through verbatim, and a footer with "View the live section" and
an unsubscribe line. Plainer than the console throughout.

ALSO PRODUCE: empty state — line-art envelope over a chart, "No digests yet", the sentence "Send
a scheduled snapshot of School Vitals to your team.", primary "New digest"; the delete modal
naming the digest and its recipients; a loading skeleton; and a 390px mobile frame.
```

---

## Not duplicated here

Two screens in this module are tenant-wide rather than per-section, and are already specified in
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) — build them once
and scope them by slug rather than re-prompting:

- **Widget library** (`/admin/insights/school-vitals/library`) — the catalogue is the same
  component with the section preselected in its "Adding to" control.
- **Settings** (`/admin/insights/school-vitals/settings`) — defaults, refresh, per-section
  access, and house visualization defaults are tenant-wide; School Vitals is one row in its
  access table.

---

## Backend gaps these prompts assume

Much smaller than for the other modules — the insights backend now implements most of what the
Dashboard prompts had to treat as future work.

| Prompt feature                                                                                                              | Status                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Section endpoint with `range` (12m / 30d / ytd), `generatedAt`, `currency`, alerts, widgets, layout                         | exists                                                                           |
| The fourteen KPIs and seven widgets, exact titles and order                                                                 | exists                                                                           |
| Widget `deltaPct`, `deltaAbs`, `sparkline`, `href`, `footnote`                                                              | exists                                                                           |
| The five school-vitals alert rules with configurable thresholds and severity escalation                                     | exists                                                                           |
| Alert mute durations (1d / 7d / forever), resolve, alert state persistence                                                  | exists                                                                           |
| Saved layout: per-widget hidden, span, viz, order, plus density and sharing (private / tenant)                              | exists                                                                           |
| Widget detail: description, comparison, average, insight note, split options and data, related links, failure rate          | exists                                                                           |
| Per-slug library, settings, and digests endpoints                                                                           | exist                                                                            |
| Tenant email domains for the outside-domain warning; viewer roles for access                                                | exist                                                                            |
| Dedicated funnel screen — per-stage daily series, previous-window overlay                                                   | needs backend; the section widget returns stage totals only                      |
| Content health per-signal evidence chips (storage held, never-active count, paid learners among inactive, oldest open case) | needs backend, or a cross-report join to Resource Usage and the moderation queue |
| Content health 12-period trend per signal                                                                                   | needs backend                                                                    |
| Digest send history and per-send delivery outcomes                                                                          | verify what the digests endpoint returns before building the 30-day strip        |

One correctness note carried into the addendum: the engagement funnel's stages are independent
event counts, not a cohort funnel, so the design deliberately omits stage-to-stage conversion
percentages. If a future backend adds a true cohort funnel, that is a different widget with a
different title — do not retrofit conversion arithmetic onto this one.
