# Google Stitch Prompts — Dashboard (`/admin/insights/dashboard`)

Paste **Block 0 (Design System)** first, then **Block 0-ID (Insights Dashboard addendum)**, then
one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the report-module files; reproduced here so this file stands
alone.

Source of truth:

- `frontend/apps/web/src/features/admin/insights/AdminInsightDashboardPage.tsx`
- `frontend/apps/web/src/features/admin/insights/admin-insights-api.ts`
- `frontend/apps/web/src/features/admin/insights/admin-insights-catalog.ts`
- `frontend/apps/web/src/features/analytics/viz/*` (`VizType`, `NormalizedResult`, compatibility,
  preference)
- `backend/apps/api/src/server/insights/insights.service.ts` (the real widget and alert set)

**This is not a report.** Reports live at `/admin/reports/*` and are tables with filters.
Insights is a widget-driven dashboard system: the server returns a `slug`, a `currency`, an
`alerts` array, and a `widgets` array where each widget carries a title, a `defaultViz`, a
`span`, and a `NormalizedResult` payload. The client picks the visualization, remembers the
choice per widget in local storage, and lays widgets out by span. Design for that contract, not
for a hand-placed dashboard.

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

## Block 0-ID — Insights Dashboard addendum (paste second)

```text
INSIGHTS DASHBOARD MODULE ADDENDUM — applies to every screen in /admin/insights/*

WHAT THIS MODULE IS
A widget-driven dashboard system, not a report. The server returns a dashboard object per slug
carrying a title, a currency, an alerts array, and a widgets array. Each widget carries an id, a
title, a default visualization, a span, and a normalized data payload of columns and rows. The
client chooses how to draw it and remembers that choice. Design every screen as a renderer of
that contract — nothing here is hand-placed, and any widget must survive being moved, resized,
or redrawn as a different chart type.

THE SIX INSIGHT SECTIONS (real slugs — this is the module's own nav)
dashboard · school-vitals · sales-insight · live-dashboard · marketing-insight ·
messenger-insight.
Render them as the module tab strip on every screen, with "Dashboard" active by default. Never
invent a seventh.

THE WIDGET FRAME — one component, used everywhere
Every widget is a Panel Surface block with a consistent frame: the title at 14px/600 on the
left; on the right a compact visualization switcher and a kebab. The switcher shows only the
visualization types that the widget's data actually supports — a single-value payload offers
KPI and table and nothing else; a time series offers line, area, bar, combo, and table. Never
show an incompatible option greyed out; omit it. The chosen type is remembered per widget across
visits, so mark the active option clearly and add a small "Default" caption beside the type the
server suggested, so an admin can tell their own choice from the shipped one.
The kebab holds: Expand, Change visualization, View underlying data, Copy as CSV, Export, Refresh
this widget, Remove from dashboard.
Widget spans are exactly three: full, half, third. Honour them — a widget authored as half must
never render full width on desktop.

THE VISUALIZATION SET (real enum, exactly these fourteen)
kpi · table · pivot · line · area · bar · combo · pie · donut · funnel · progress · scatter ·
heatmap · sparkline.
Pie and donut exist in the system and must appear in the switcher when the data supports them,
but they are never a default and never the shipped choice for a new widget — the defaults are
kpi for single values, line for time series, bar for categorical comparison, table for detail.
State that rule once in the customize screen rather than repeating it per widget.

KPI WIDGETS
A KPI widget shows the label at 12px/600 uppercase Muted Ink, the value at 28px monospace with
its unit or currency code at 60% size, a delta caption against the previous period in plain
words, and a sparkline along the bottom edge where a series is available. Currency values use
the dashboard's own currency field and always show the code — "1,84,600.00 INR" — never a bare
glyph. A KPI with no comparison period shows no delta caption rather than a zero delta.

THE REAL DASHBOARD COMPOSITION (slug: dashboard)
Six KPIs, each span third: Revenue · Products · Learners · Current MAU · Active users (30d) ·
Active enrollments.
Then, in order: Monthly revenue (12 months), line, full · Monthly enrollments (paid vs free),
bar, full · Top products, table, half · Orders by status, bar, half · Recent failed payments,
table, full · Learning activity, line, full · Pending tasks, table, half · Upcoming live
classes, table, half.
Use exactly these titles and this order in mockups.

ALERTS ARE PART OF THE CONTRACT, NOT DECORATION
The server returns alerts with a severity of info, warning, or critical, a title, a message, and
an optional href. Render them as a stack of full-width strips above the widgets — Danger tint
for critical, Warning for warning, Sunken Surface for info — each one line of title in 600
weight followed by the message, with a chevron link on the right where an href exists and no
affordance at all where it does not. Never render an alert as a toast, never auto-dismiss one,
and never invent a severity. An alert with no href must not look clickable.

EMPTY WIDGETS ARE NORMAL
A widget whose data payload has zero rows renders inside its own frame with a small line-art
mark and one sentence naming why it is empty in that widget's own terms ("No failed payments in
this period"), plus a link to the relevant report where one exists. Never blank the frame, never
collapse the widget out of the layout, never show a zero-value chart axis as if it were data.

DATA REALISM
Currency in the dashboard's currency with the code shown: 1,84,600.00 INR. Product titles like
"Funded Trader Foundations", "Risk Desk Masterclass". Learner names like "Priya Raghunathan",
"Tomás Beltrán", "Ade Okonjo". Counts like 42, 218, 3,412, 12,840. Periods as real months.
```

---

## Screen 1 — `/admin/insights/dashboard` (the dashboard)

```text
Screen: Insights — Dashboard. Route /admin/insights/dashboard. Desktop 1440px, admin sidebar
with "Insights" expanded and "Dashboard" active.

HEADER
Breadcrumb: Admin / Insights / Dashboard. Title "Dashboard", subtitle "Revenue, learners, and
operations at a glance." Right side: a period select reading "Last 12 months", a currency chip
showing the dashboard's currency ("INR") rendered as a plain Muted Ink chip rather than a
control, a secondary "Customize" button, a secondary "Export" button, and a primary "Refresh"
button with a "Last updated 4 minutes ago" caption beneath it in Muted Ink.

MODULE TAB STRIP (the six real sections, under the header)
Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing Insight · Messenger
Insight. Underline tabs, "Dashboard" active in Accent Indigo. Each inactive tab carries a
one-line tooltip describing what it covers.

ALERT STACK — directly beneath the tab strip, before any widget, per the addendum. Render three
alerts to prove all three severities and both href states:
  - Critical: "Failed payments — 14 payments failed recently. Recover revenue from Reports →
    Payments." with a chevron link.
  - Info: "Pending tasks — 9 open ops items (reviews, moderation, deletions, or course
    reviews)." with no link and no clickable affordance.
  - Info: "Upcoming live classes — 3 live sessions scheduled or live." with a chevron link.

KPI ROW — the six KPI widgets in their own grid, four columns on desktop, two on tablet: Revenue
(currency, with the code), Products, Learners, Current MAU, Active users (30d), Active
enrollments. Each rendered per the addendum's KPI spec — label, big monospace value, delta
caption, bottom-edge sparkline. Show Revenue and Learners with sparklines and deltas; show
Products with a delta but no sparkline; show Current MAU with neither, to prove the no-comparison
variant. Each card carries the compact visualization switcher on hover, offering only KPI and
Table.

WIDGET GRID — a two-column grid beneath the KPIs where full-span widgets occupy both columns and
half-span widgets one, in this exact order:
1. "Monthly revenue (12 months)" — full — a line chart over 12 monthly points, Accent Indigo,
   currency on the axis with the code, a dashed average line, and a caption naming the best and
   worst month.
2. "Monthly enrollments (paid vs free)" — full — a grouped bar chart with two series, paid in
   full Accent Indigo and free at 60% tint, inline legend above the plot, and a caption naming
   the paid share.
3. "Top products" — half — a compact table: Product (title with a type chip beneath) | Learners
   | Revenue (monospace with the currency code) | a mini share bar. Five rows, leader tinted
   Accent Wash.
4. "Orders by status" — half — a horizontal bar per order status (Paid, Pending, Failed,
   Refunded, Cancelled) with counts in monospace, Failed rendered in Danger.
5. "Recent failed payments" — full — a table: Learner (name over email) | Product | Amount
   (monospace with the code) | Gateway chip | Failure reason (truncated to one line) | Attempted
   (relative + absolute) | a "View" text link. Six rows, each with a Danger left rail.
6. "Learning activity" — full — a multi-line chart with a togglable inline legend covering
   lessons completed, assessments submitted, assessments passed, practice sessions, certificates
   issued, community posts, path steps completed, and moderation cases opened — with only the
   first three enabled by default and the rest available from the legend.
7. "Pending tasks" — half — a table: Task type (Publish review, Moderation case, Deletion
   request, Course review) | Count (monospace) | Oldest item (relative) | a "Open" text link per
   row.
8. "Upcoming live classes" — half — a table: Session (title with course chip beneath) |
   Scheduled (monospace with a relative caption) | Status pill (Scheduled / Live) | Registered
   (monospace) | a "View" link. A row whose status is Live carries a Success rail and a "Live
   now" caption.

Every widget uses the shared frame from the addendum, with its switcher offering only the
compatible types and a "Default" caption beside the server's suggestion.

ALSO PRODUCE as separate frames:
A. Loading — the alert stack as two shimmer strips, KPI cards as shimmer blocks preserving the
   grid, and each widget frame with a skeleton matching its default visualization (line
   placeholder for line widgets, row skeletons for tables).
B. Empty widgets — the same layout with "Recent failed payments" and "Upcoming live classes"
   rendered in their empty states per the addendum, everything else populated, so the
   empty-inside-frame treatment is proven in context.
C. No alerts — the alert stack absent entirely with no placeholder and no reserved space.
D. Error — a single inline Danger strip in place of the whole widget grid reading "Couldn't load
   the dashboard." with Retry, the alert stack and KPIs still shown if they loaded.
E. Mobile 390px — module tabs horizontally scrollable, alerts full width, KPIs two-up, every
   widget full width in source order, tables inside widgets scrolling horizontally within their
   own frame.
```

---

## Screen 2 — `/admin/insights/dashboard/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/dashboard/widgets/[widgetId]. The expanded view of
a single widget — reached from the widget frame's Expand action. Produce it as a full page, and
also as a full-screen overlay variant that keeps the dashboard visible behind a scrim.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Monthly revenue (12 months). Title: the widget title,
with a Muted Ink subtitle naming its source in plain words ("Paid payment orders, grouped by
month") and the widget id in 10px monospace with a copy icon. Right: a visualization switcher
rendered here as a full labelled segmented control rather than the compact one, showing only
compatible types with the server default marked; a period select; a secondary "Copy as CSV"
button; a secondary "Export" button; and a primary "Open the full report" button linking to the
report this widget summarises.

CHART PANEL — the widget at full width and roughly 420px tall, with the affordances the small
frame cannot afford: axis labels, a legend row above the plot that toggles series, hoverable
points with a value tooltip, a dashed average or benchmark line where meaningful, and a brush
strip beneath the plot for zooming a sub-range. Beneath the chart, a caption row of two or three
plain-language observations derived from the data — "Revenue peaked at 2,41,800.00 INR in March
and has fallen for two consecutive months."

UNDERLYING DATA — a Sunken Surface panel beneath the chart, collapsed by default behind a
"Show underlying data" toggle, expanding to the exact normalized payload as a table: one column
per normalized column with its kind shown as a 10px monospace marker in the header (dimension,
measure, string, number, date), every row, right-aligned measures, and a footer giving the row
count and a "Copy as CSV" text button. This is the trust anchor of the screen — an admin should
always be able to see the numbers behind the picture.

CONTEXT RAIL — an asymmetric 68/32 layout with three stacked panels on the right:
1. "Comparison" — the same measure over the previous equivalent period drawn as a faint Muted
   line behind the current one when toggled, plus label/value rows for current, previous, delta,
   and percentage change.
2. "Breakdown" — a "Split by" select offering the dimensions available in the payload (product,
   gateway, enrolment type, course), redrawing the chart as a stacked or grouped series with an
   inline legend. Where the payload has no additional dimension, this panel reads "This widget
   has no further breakdown" rather than showing an empty control.
3. "Related" — links out as rows with chevrons to the reports that hold the detail behind this
   widget, each with a one-line description.

ALSO PRODUCE: the table-widget variant of this screen — where the widget's default is a table,
the chart panel is replaced by the full table with sorting, a search input, and pagination, and
the underlying-data panel is omitted as redundant; a loading skeleton; an empty variant with the
widget's own empty sentence and the related links still shown; and a 390px mobile frame where
the context rail stacks beneath and the brush strip is removed.
```

---

## Screen 3 — `/admin/insights/dashboard/alerts`

```text
Screen: Alerts. Route /admin/insights/dashboard/alerts. Everything the dashboard is currently
flagging, everything it flagged before, and the rules that decide.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Alerts. Title "Alerts", subtitle "What the dashboard
is flagging across insights, and how those thresholds are set." Right: secondary "Export CSV",
secondary "Alert rules", primary "Mark all as seen".

SUMMARY BAND (unequal cells, first double width): "Open alerts 6" at 32px monospace with the
caption "1 critical · 2 warning · 3 info" and a thin three-segment composition bar | "Critical 1"
in Danger, clickable to filter | "New since yesterday 2" | "Resolved this week 11" in Success |
"Muted rules 2" in Muted Ink.

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN (default): a list of full-width strips matching the dashboard's alert rendering
exactly, so the two surfaces never diverge: severity-tinted background, title at 15px/600, the
message beneath, and on the right the source section chip (Dashboard, Sales Insight, Live
Dashboard…), a first-seen timestamp in monospace, a chevron where an href exists, and a kebab
(Open the linked page, Mute this rule for 7 days, Mark as resolved, Copy alert id). Group the
strips under hairline headers by severity with counts, critical first. Show 6 alerts covering
all three severities, including two with no href rendered flat and unclickable.

TAB 2 — RESOLVED: a table rather than strips, because history reads better dense: Alert (title
with the message truncated to one line beneath) | Severity pill | Source section chip | First
seen | Resolved (relative + absolute) | Resolved by (a name, or "Automatically" in Muted Ink
where the underlying condition simply cleared) | Duration open (monospace) | a kebab. Show 8
rows.

TAB 3 — MUTED: the same table plus a "Muted until" column in Warning and an "Unmute" text button
per row, with a caption above explaining that muting hides the alert from the dashboard but does
not change the underlying condition.

TAB 4 — RULES: one Panel Surface block per rule, each with the rule name, a plain-English
statement of the condition ("Raise a warning when any payment fails; raise it as critical at 10
or more"), the severity it produces as a pill, an enabled toggle, a "last fired" caption, and an
inline threshold control where the rule has a number. Show the three real dashboard rules —
failed payments, pending tasks, upcoming live classes — plus two from other insight sections, so
the cross-section nature is visible. A dashed "New rule" tile at the end.

ALSO PRODUCE: the all-clear empty state for the Open tab — a line-art mark of a level line,
heading "Nothing is flagged right now", the sentence "Alerts appear here when a dashboard rule
fires.", and a secondary "Alert rules"; the mute-confirmation modal naming the rule, the
duration, and what stops appearing; a loading skeleton; and a 390px mobile frame where the view
tabs scroll horizontally and rule blocks stack their controls.
```

---

## Screen 4 — `/admin/insights/dashboard/customize`

```text
Screen: Customize dashboard. Route /admin/insights/dashboard/customize. Where an admin arranges
which widgets appear, how big they are, and how they are drawn.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Customize. Title "Customize", subtitle "Choose which
widgets appear on this dashboard, their size, and how each is drawn." Right: secondary "Reset to
default layout", secondary "Preview", primary "Save layout" — disabled until something changes,
with an unsaved-changes caption in Warning beside it when dirty.

LAYOUT — asymmetric 68/32.
LEFT — the canvas: a live arrangement of the dashboard at reduced fidelity. Each widget renders
as a Panel Surface block showing only its title, a small visualization-type chip, and a span
chip (Full / Half / Third), sized to its actual span within a two-column grid so the real rhythm
is visible. Each block carries a drag handle on its left edge, and on hover a control row: a
span segmented control (Third / Half / Full), a visualization select showing only compatible
types, and a remove x. A dragged block shows a 2px Accent Indigo insertion line at its drop
position and the rest of the grid reflows behind it at 150ms. The KPI row sits at the top as its
own bounded region with a caption "KPIs always render first" — KPI widgets can be reordered
within it and removed, but not dragged into the widget grid.
A dashed "Add widget" tile sits at the end of the grid, opening the library.

RIGHT — three stacked panels:
1. "Layout" — label/value summary: widgets shown, widgets hidden, KPI count, and a "Density"
   segmented control (Comfortable / Compact) with a caption on what it changes.
2. "Defaults" — a short explainer panel stating the visualization default rule in one sentence
   ("Single values default to KPI, time series to line, comparisons to bar, detail to table —
   pie and donut are available but never default"), plus a "Reset every widget to its server
   default" text button.
3. "Sharing" — a radio: "Only me" / "Everyone with dashboard access", with a caption noting that
   a shared layout replaces the default for other admins and naming how many people that
   affects. Beneath, a "Copy layout to another section" combobox listing the other five insight
   slugs, with a caption warning that widgets not available in that section are skipped.

ALSO PRODUCE: the preview state — the customize chrome hidden and the real dashboard rendered
from the pending layout with a fixed bottom bar reading "Previewing unsaved layout" plus
"Discard" and "Save layout"; the reset-confirmation modal naming how many widgets return and what
personal visualization choices are cleared; a loading skeleton; and a 390px mobile frame where
the canvas becomes a reorderable single-column list with up and down controls in place of drag,
and the right rail collapses into an accordion.
```

---

## Screen 5 — `/admin/insights/dashboard/library`

```text
Screen: Widget library. Route /admin/insights/dashboard/library. The catalogue of widgets that
can be added to any insight section.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Library. Title "Widget library", subtitle "Everything
that can be added to an insights dashboard." Right: a "Adding to" select showing which section
the chosen widgets will land on, defaulting to Dashboard, and a primary "Add selected (3)".

FILTER BAR
Search ("Search widget title or what it measures"), "Section" multi-select listing the six real
slugs, "Category" multi-select (Revenue, Learners, Learning activity, Live, Marketing,
Messaging, Operations), "Visualization" multi-select listing the fourteen real types, "Data
shape" select (Single value, Time series, Category comparison, Detail table, Distribution), and
an "Already on this dashboard" toggle. Chips beneath with "Clear all".

CATALOGUE — a two-column grid of preview blocks rather than a dense table, because choosing a
widget is a visual decision. Each block: the widget title at 14px/600; a one-line description of
what it measures; a small live-looking thumbnail of its default visualization drawn at about
120px tall using real-looking values; a chip row carrying its default visualization, its default
span, and its source section; and a footer with an "Add" secondary button that becomes a
checked "Added" state, plus a "Preview" text button. Blocks already on the current dashboard are
rendered at reduced emphasis with an "On this dashboard" chip and their Add button replaced by
"Remove". Group blocks under hairline category headers. Show 8 blocks spanning KPI, line, bar,
table, funnel, and heatmap defaults, so the variety of thumbnails is proven.

PREVIEW DRAWER — opened by a block's Preview button: the widget rendered at full drawer width
with real-looking data, its description, a label/value block naming its data source and refresh
cadence, the full list of visualizations it supports as chips with the default marked, and a
sticky footer with "Add to Dashboard" as the primary plus a section select beside it.

ALSO PRODUCE: an empty search state ("No widgets match these filters" with a "Clear filters"
button); a loading skeleton where thumbnails are shimmer blocks at the right aspect; and a 390px
mobile frame where the catalogue is a single column and the preview drawer becomes a full-screen
sheet.
```

---

## Screen 6 — `/admin/insights/dashboard/digests`

```text
Screen: Dashboard digests. Route /admin/insights/dashboard/digests. Scheduled snapshots of a
dashboard, delivered by email.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Digests. Title "Digests", subtitle "Email a snapshot
of this dashboard on a schedule." Right: secondary "Send a test to myself", primary "New digest".

SUMMARY BAND (unequal cells, first double width): "Digests 5" at 32px monospace with the caption
"4 enabled · 1 paused" | "Sends this month 22" with "21 delivered" | "Recipients 14" with the
caption "3 outside your domain" in Warning | "Next send in 14 hours" with the digest name
beneath | "Failing 1" in Danger, clickable.

LIST — one Panel Surface block per digest:
LEFT — identity: the digest name at 15px/600, the section it snapshots as a chip, a cadence line
in monospace ("Every Monday, 08:00 Asia/Kolkata"), and a content caption naming what is included
("6 KPIs, 4 widgets, alerts included").
RIGHT — delivery: recipient chips with any address outside the tenant domain carrying a Warning
marker, a last-sent line with a status pill, a 30-day strip of one small square per send tinted
by outcome, an enabled toggle, and a kebab (Edit, Send now, Duplicate, View send history,
Pause, Delete). Failing digests carry a Danger left rail with the transport error inline.
Show 4 blocks including one paused at reduced emphasis and one failing.

NEW DIGEST DRAWER — produce as its own frame: a name field; a section select defaulting to
Dashboard; a "Contents" block with checkboxes for "Include alerts" (on), "Include KPIs" (on),
and a widget checklist mirroring the dashboard's own widget order with a running caption "4 of 8
widgets selected"; a "Period" select; a "Format" radio (Inline email with charts as images /
Inline email plus a CSV attachment / Link to the live dashboard only) with a caption under each
naming the trade-off; a recipients chips input with the outside-domain warning behaviour from
the exports module; a cadence, time, and timezone set; and a footer with "Send a test" secondary
and "Create digest" primary.

EMAIL PREVIEW — produce one frame showing what the digest actually looks like in an inbox: a
narrow 640px email body on Page Canvas with the tenant name, the dashboard title, the period, an
alert block at the top rendered in the same severity treatment, the KPI values as a simple
two-column label/value list rather than cards, each included widget as a static chart image with
its title above, and a footer with a "View the live dashboard" link plus an unsubscribe line.
Keep it deliberately plainer than the console — email clients are not the console.

ALSO PRODUCE: empty state — line-art mark of an envelope over a chart, heading "No digests yet",
sentence "Send a scheduled snapshot of this dashboard to your team.", primary "New digest"; the
delete modal naming the digest and its recipients; a loading skeleton; and a 390px mobile frame.
```

---

## Screen 7 — `/admin/insights/dashboard/settings`

```text
Screen: Insights settings. Route /admin/insights/dashboard/settings. How the insight dashboards
behave for everyone in the tenant.

HEADER
Breadcrumb: Admin / Insights / Dashboard / Settings. Title "Settings", subtitle "Defaults,
refresh behaviour, and access for every insights dashboard." Right: secondary "View audit log",
primary "Save changes" — disabled until a field changes, with an unsaved-changes caption in
Warning beside it when dirty.

SECTION 1 — DEFAULTS, a Panel Surface form:
- "Default section" a select listing the six real slugs, default Dashboard, helper "Where
  Insights opens from the sidebar."
- "Default period" a select (Last 30 days / Last 3 months / Last 12 months / Year to date).
- "Display currency" a select with a caption stating plainly that this affects display only and
  that amounts are converted at the rate recorded on each transaction — and a second caption
  naming which sections carry currency values.
- "Week starts on" a segmented control (Sunday / Monday).
- "Number formatting" a select (Indian grouping / International grouping) with a live sample
  beneath in monospace.

SECTION 2 — REFRESH, full-width toggle rows with helper text:
- "Refresh dashboards automatically" toggle, on, with an interval select revealed beneath and a
  caption naming the cost ("Each refresh re-runs every widget query on this section").
- "Show the last-updated time on every dashboard" toggle, on.
- "Cache widget results for" a numeric stepper in minutes with a caption explaining that a
  manual refresh always bypasses the cache.

SECTION 3 — ACCESS, a compact table rather than a form: one row per insight section with the
section name and slug in monospace, a "Visible to" role multi-select rendered as chips, a
"Contains personal data" marker where the section's widgets expose learner detail, and a
"Default layout" cell naming whether the tenant default or the shipped default applies, with a
"Reset" text button. Six rows, one per real slug.

SECTION 4 — WIDGET DEFAULTS, a short table: one row per visualization default rule — Single
value → KPI, Time series → Line, Category comparison → Bar, Detail → Table, Distribution →
Heatmap — each with a select to change the house default and a caption noting that pie and donut
remain available in switchers but cannot be set as a default here.

SECTION 5 — AUDIT, a preview: the last 8 governance events as a timeline — default period
changed; the Sales Insight section restricted to two roles; a shared layout published; auto
refresh disabled — each with a monospace timestamp and admin name, plus a "View full audit log"
link.

ALSO PRODUCE: the leave-with-unsaved-changes modal; a confirmation modal for restricting a
section's visibility that names how many admins lose access; a loading skeleton; and a 390px
mobile frame where the access and widget-default tables become stacked cards.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                                  | Status                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/insights/[slug]` returning slug, title, currency, alerts, widgets                                  | exists                                                                                                                                        |
| Widget contract: id, title, `defaultViz`, `span` (full/half/third), normalized data payload                     | exists                                                                                                                                        |
| Alert contract: id, severity (info/warning/critical), title, message, optional href                             | exists                                                                                                                                        |
| The six insight sections as a catalog                                                                           | exists (frontend catalog + server title map)                                                                                                  |
| The exact dashboard composition — 6 KPIs plus 8 widgets, in order                                               | exists                                                                                                                                        |
| The three dashboard alert rules (failed payments, pending tasks, upcoming live)                                 | exists                                                                                                                                        |
| Fourteen visualization types, compatibility resolution, per-widget preference in local storage                  | exists — the switcher is already backed                                                                                                       |
| Period selection                                                                                                | **not in the contract** — the dashboard returns fixed windows (12 months, 30 days) with no period parameter; the header control needs backend |
| Deltas and comparison periods on KPIs                                                                           | needs backend — no previous-period values are returned                                                                                        |
| Widget-level refresh, expand, underlying-data view, copy as CSV                                                 | the payload is already client-side, so expand and copy are frontend-only; per-widget refresh needs an endpoint                                |
| Split-by breakdowns on the widget detail                                                                        | needs backend — payloads carry one dimension set                                                                                              |
| Alert history, resolution, muting, and configurable rules                                                       | needs backend — alerts are computed fresh on each request with hard-coded thresholds and no persistence                                       |
| Custom layouts, per-admin and shared, add/remove/reorder/resize                                                 | needs backend — the widget list is server-composed and fixed                                                                                  |
| Widget library and catalogue metadata (descriptions, categories, thumbnails)                                    | needs backend                                                                                                                                 |
| Digests, email snapshots, send history                                                                          | needs backend                                                                                                                                 |
| Settings: default section and period, display currency, refresh cadence, per-section access, house viz defaults | needs backend                                                                                                                                 |

One contract note worth carrying into the build: `currency` is optional on the dashboard object,
so every currency-bearing widget needs a defined fallback — the addendum's rule of always showing
the code makes that safe, but the design must not assume the field is present.
