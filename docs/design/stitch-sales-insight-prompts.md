# Google Stitch Prompts — Sales Insight (`/admin/insights/sales-insight`)

Paste **Block 0 (Design System)**, then **Block 0-ID (Insights module addendum)**, then
**Block 0-SI (Sales Insight addendum)**, then one screen prompt per generation.

Block 0 and Block 0-ID are unchanged from
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) and
[stitch-school-vitals-prompts.md](./stitch-school-vitals-prompts.md) — if you are already in that
Stitch project, skip straight to Block 0-SI.

Source of truth:

- `backend/apps/api/src/server/insights/insights.service.ts`
  (`buildSalesInsightWidgets`, `salesInsightAlertMetrics`, `salesConversionRate`)
- `backend/apps/api/src/server/insights/insights-alerts.ts` (the three sales-insight rules)
- `backend/apps/api/src/server/insights/insights.schemas.ts` (widget, layout, alert contracts)

**One thing to know before designing.** School Vitals has been upgraded to the newer contract —
its widget builder takes the `range`, retitles series widgets to match it, and attaches deltas
and footnotes. **Sales Insight has not.** `buildSalesInsightWidgets` takes only the snapshot: no
range parameter, no `deltaPct`, no `deltaAbs`, no `sparkline`, no `footnote`. Its windows are
baked into the widget titles instead — "(30d)", "(all time)", "(12 months)". The addendum below
makes that honest rather than papering over it, and the gaps table says what would need to
change.

---

## Block 0-SI — Sales Insight addendum (paste third)

```text
SALES INSIGHT SECTION ADDENDUM — applies to every screen under /admin/insights/sales-insight

WHAT THIS SECTION ANSWERS
Where revenue comes from and where it leaks. Not "are learners healthy" — that is School Vitals
— but how many people arrive, how many convert, what they buy, which sources bring them, and
which payments fail. The audience is whoever owns the number.

THIS SECTION DOES NOT RESPOND TO THE RANGE CONTROL — SAY SO
Every window in Sales Insight is fixed in the widget's own title: "(30d)", "(all time)",
"(12 months)". The section is computed from a snapshot without a range parameter, so changing
the range control changes nothing here. Handle it exactly this way and no other:
  - keep the range control visible for consistency with the rest of Insights, but render it
    disabled with a Muted Ink caption beside it reading "Sales Insight uses fixed windows shown
    in each widget title";
  - never hide the control, never let it look active, and never redraw a widget as if it had
    changed;
  - carry the same caption once beneath the KPI region.
This is a real property of the data, not a bug to design around.

NO DELTAS IN THIS SECTION
Sales Insight widgets carry no deltaPct, deltaAbs, or sparkline. So KPI cards here render label,
value, and nothing else — no delta caption, no bottom-edge sparkline, no comparison arrow. Do
not invent them. Where a comparison genuinely exists it is expressed as a *pair of KPIs* — total
versus 30-day — and those pairs must sit adjacent so the comparison is read across two cards
rather than implied inside one.

THE TWELVE KPIs — exactly these, in exactly this order, all span third
Total revenue · Revenue (30d) · Paid orders · Failed orders · Products · Learners ·
Paid enrollments · Trial + free pool · Conversion rate % · Conversion rate % (30d) ·
Enrollments (30d) · Paid enrollments (30d).
Group them under three hairline sub-headers rather than running twelve identical cards:
"Revenue" (Total revenue, Revenue (30d), Paid orders, Failed orders), "Catalogue and audience"
(Products, Learners, Paid enrollments, Trial + free pool), "Conversion" (Conversion rate %,
Conversion rate % (30d), Enrollments (30d), Paid enrollments (30d)).
Money KPIs use the dashboard currency and always show the code. "Failed orders" is inverted —
higher is worse — and carries a Warning tint and a caption saying so. The two conversion-rate
KPIs are whole-number percentages with a trailing % and a 3px bar, never bare integers.

THE NINE WIDGETS — exactly these titles, in exactly this order
1. Monthly revenue (12 months) — line — full
2. Sales pipeline (all time) — funnel — half
3. Sales pipeline (30d) — funnel — half
4. Enrollments by channel — bar — half
5. Orders by status — bar — half
6. Top products by sales — table — full
7. Top attribution sources — table — half
8. Conversion opportunity — table — half
9. Recent failed payments — table — full

THE PIPELINE IS A REAL FUNNEL — AND IT HAS EXACTLY THREE STAGES
Visited → Started diagnostic → Enrolled. Unlike the School Vitals engagement funnel, these ARE
sequential stages, so stage-to-stage conversion percentages are legitimate here and should be
drawn: a small percentage label on the connector between each pair of bars, plus the overall
visited-to-enrolled rate as a caption. Conversion rate is computed as enrolled ÷ visited and
rounded to a whole number — match that rounding exactly, and where visited is zero show an em
dash with the caption "No pipeline events recorded", never 0%.
The two pipeline widgets are a matched pair — all-time beside 30-day. Draw them on a shared
visual scale relationship so the eye can compare shape, and caption the pair with the difference
in conversion rate between the two windows.

MONEY RENDERING
Amounts are returned in major units already converted from cents. Render monospace, right-
aligned in tables, decimals aligned, with the currency code as an 11px Muted Ink suffix:
"1,84,600.00 INR". Attributed revenue in the sources table follows the same rule. Never a bare
glyph, never a summed figure across currencies.

ORDER STATUS VALUES COME FROM THE DATA, NOT FROM A FIXED LIST
"Orders by status" renders whatever statuses the payload contains, in the payload's own order.
Tint only what is unambiguous — anything reading "failed" in Danger, "paid" or "succeeded" in
Success — and leave the rest neutral. Never assume a five-status set, never render a status the
payload did not include as a zero bar.

CONVERSION OPPORTUNITY IS FIVE SEGMENTS, AND TWO OF THEM OVERLAP
The segments are Paid enrollments · Trial enrollments · Free enrollments · Offline / manual ·
Online (paid+free+trial). The last is a rollup of three of the others, so the five rows must
never be drawn as a pie, a donut, or a stacked bar — they do not sum to a whole. Render as a
plain table with counts in monospace and a mandatory Muted Ink caption: "Online is a rollup of
paid, free, and trial. These segments overlap and do not sum to the learner total."

THE THREE ALERT RULES — exactly these, no others
failed-payments (warning on any failure, critical at threshold) · pending-orders (info) ·
low-conversion (warning). This is the only insight section whose rules can produce a critical,
so the Danger strip treatment belongs here and must be designed.

DATA REALISM FOR THIS SECTION
Revenue like 41,86,200.00 INR total and 3,84,900.00 INR for 30 days. Orders like 1,284 paid, 47
failed, 12 pending. Conversion rates like 6% all-time and 9% for 30 days. Pipeline like 18,420
visited, 2,140 started diagnostic, 1,284 enrolled. Sources like "google / organic",
"instagram / paid", "direct", "referral / partner-rd". Products like "Funded Trader
Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp".
```

---

## Screen 1 — `/admin/insights/sales-insight` (the section)

```text
Screen: Insights — Sales Insight. Route /admin/insights/sales-insight. Desktop 1440px, admin
sidebar with "Insights" expanded and "Sales Insight" active.

HEADER
Breadcrumb: Admin / Insights / Sales Insight. Title "Sales Insight", subtitle "Where revenue
comes from, and where it leaks." Right side: the range segmented control rendered DISABLED with
the Muted Ink caption "Sales Insight uses fixed windows shown in each widget title" beside it, a
secondary "Customize" button, a secondary "Export" button, and a primary "Refresh" button with a
"Generated 4 minutes ago" caption beneath in Muted Ink.

MODULE TAB STRIP: Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing
Insight · Messenger Insight, with "Sales Insight" active.

ALERT STACK — beneath the tab strip. Render three alerts from this section's three real rules,
proving that this is the section where a critical belongs:
  - Critical: "Failed payments — 47 payments failed recently. Recover revenue from Reports →
    Payments." with a chevron link, on a Danger-tinted strip.
  - Warning: "Low conversion (30d) — 6% of visitors enrolled, below your 8% threshold." with a
    chevron link.
  - Info: "Pending orders — 12 orders are pending or processing." with no link and no clickable
    affordance.

KPI REGION — twelve cards in a four-column grid under three hairline sub-headers, exactly as the
addendum specifies. Every card is label plus value only — no deltas, no sparklines anywhere in
this region, and the design must look deliberate rather than unfinished, so give the value more
vertical room than a delta-bearing card would have.
"Revenue" — Total revenue (41,86,200.00 INR), Revenue (30d) (3,84,900.00 INR), Paid orders
(1,284), Failed orders (47, Warning-tinted with the caption "Higher is worse").
"Catalogue and audience" — Products (42), Learners (12,840), Paid enrollments (3,412), Trial +
free pool (2,186).
"Conversion" — Conversion rate % (6% with a 3px bar), Conversion rate % (30d) (9% with a bar),
Enrollments (30d) (486), Paid enrollments (30d) (312).
Beneath the region, the fixed-window caption repeated once in Muted Ink.

WIDGET GRID — two-column, in the exact order from the addendum:
1. "Monthly revenue (12 months)" — full — a line chart over 12 monthly points, currency with the
   code on the axis, a dashed 12-month average line, and a caption naming the best and worst
   month with their values.
2. "Sales pipeline (all time)" — half — a three-stage funnel: Visited 18,420 → Started
   diagnostic 2,140 → Enrolled 1,284, drawn as three descending horizontal bars with a
   stage-to-stage conversion percentage on the connector between each pair, each bar labelled
   with its count in monospace, and a caption giving the overall rate "6% visited to enrolled".
3. "Sales pipeline (30d)" — half — the identical treatment with 30-day numbers, positioned as a
   matched pair beside the all-time funnel, with a shared caption beneath the pair naming the
   difference: "Conversion is 3 points higher in the last 30 days than all time."
4. "Enrollments by channel" — half — horizontal bars, one per channel from the payload, counts
   in monospace, largest in full Accent Indigo and the rest at 60% tint.
5. "Orders by status" — half — horizontal bars from the payload's own status list, "failed"
   tinted Danger and "paid" tinted Success, everything else neutral, counts in monospace.
6. "Top products by sales" — full — a table: Product (title in Accent Indigo) | Learners
   (monospace) | Paid (monospace) | Trial (monospace, Warning tint where trial exceeds paid) |
   Revenue (monospace with the currency code, right-aligned, with a 3px share bar). Eight rows,
   leader tinted Accent Wash.
7. "Top attribution sources" — half — a table: Source (in monospace, since these are slugs like
   "google / organic") | Events (monospace) | Attributed revenue (monospace with the code and a
   3px share bar). Six rows.
8. "Conversion opportunity" — half — a table of the five segments in their fixed order with
   counts in monospace, and the mandatory overlap caption beneath. No pie, no donut, no stack.
9. "Recent failed payments" — full — a table: Learner | Product | Amount (monospace with the
   code) | Created (date in monospace). Six rows, each with a Danger left rail, and a footer
   link "Open Reports → Payments".

ALSO PRODUCE as separate frames:
A. Loading — alert strips as shimmer, twelve KPI shimmer cards keeping all three group headers,
   each widget frame skeletoned to its default visualization.
B. Empty — the same layout where "Recent failed payments" and "Top attribution sources" are in
   their empty states ("No failed payments in this window", "No attribution events recorded"),
   and both pipeline funnels show the zero-visited variant with em-dash conversion rates rather
   than 0%.
C. No alerts — the stack absent with no reserved space.
D. Error — an inline Danger strip replacing the widget grid, KPIs retained.
E. Mobile 390px — module tabs scroll horizontally, the disabled range control and its caption
   wrap to two lines, KPIs two-up with their group headers intact, every widget full width, the
   two pipeline funnels stacked but still captioned as a pair.
```

---

## Screen 2 — `/admin/insights/sales-insight/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/sales-insight/widgets/[widgetId]. The expanded view
of one widget, backed by the widget detail endpoint. Produce a full page and a full-screen
overlay variant over the section.

HEADER
Breadcrumb: Admin / Insights / Sales Insight / Monthly revenue (12 months). Title: the widget
title. Beneath it the server-supplied description as a Muted Ink sentence, and the widget id in
10px monospace with a copy icon. Right: a full labelled visualization segmented control showing
only compatible types with the server default marked; a secondary "Copy as CSV"; a secondary
"Export"; and a primary "Open the full report" driven by the endpoint's related links. No range
control on this screen — the window is fixed and stated in the title.

HEADLINE STRIP — built from the endpoint's comparison block: the current value at 32px monospace
with its currentLabel beneath, the previous value with its previousLabel, the absolute delta,
and the percentage delta tinted Success or Warning by direction — with the tint inverted and
captioned for "Failed orders". Then the endpoint's average as its own cell. Where comparison is
null the strip shows the current value alone with the caption "No comparable previous period".
For the failed-payments widget, the endpoint's failure-rate block renders as an extra cell:
current percentage, previous percentage, delta, and its note as a Muted Ink caption.

CHART PANEL — the widget at full width and about 420px tall with axis labels, a legend row that
toggles series, hover tooltips, a dashed line at the endpoint's average, and a brush strip for
zooming. Beneath, the endpoint's insightNote in a Sunken Surface strip — "Revenue fell for two
consecutive months after peaking at 2,41,800.00 INR in March."

SPLITS — a "Split by" segmented control from the endpoint's splitOptions, redrawing the chart
with an inline legend, plus a split table for the active option: Label | Value (monospace, with
the currency code where the measure is money) | Share (percentage with a 3px bar), sorted
descending. Where splitOptions is empty, one Muted Ink line replaces the region.

UNDERLYING DATA — a Sunken Surface panel behind a "Show underlying data" toggle, expanding to
the exact normalized payload: one column per normalized column with its kind as a 10px monospace
marker in the header, every row, right-aligned measures, and a footer with the row count and a
"Copy as CSV" text button.

RELATED — a right rail at 32% with the endpoint's related array as rows: title, one-line
description, chevron, and the icon type as a small Muted Ink marker.

ALSO PRODUCE: the funnel-widget variant, where the chart panel is the three-stage pipeline at
full width with per-stage counts, stage-to-stage conversion on the connectors, and a stage table
beneath; the table-widget variant, where the chart panel becomes the full sortable, searchable,
paginated table and the underlying-data panel is dropped as redundant; a loading skeleton; an
empty variant; and a 390px mobile frame where the related rail stacks beneath.
```

---

## Screen 3 — `/admin/insights/sales-insight/pipeline`

```text
Screen: Sales pipeline. Route /admin/insights/sales-insight/pipeline. The two funnel widgets
given a full screen, because comparing the two windows is the whole job.

HEADER
Breadcrumb: Admin / Insights / Sales Insight / Pipeline. Title "Sales pipeline", subtitle
"Visitors, diagnostics started, and enrolments — all time against the last 30 days." Right:
secondary "Copy as CSV", secondary "Export", primary "Open Reports → Enrollments".

HEADLINE BAND (unequal cells, first double width): "Conversion 6%" at 32px monospace with the
caption "1,284 enrolled of 18,420 visited, all time" and a 3px bar | "Conversion (30d) 9%" with
its own bar and the caption "312 of 3,480" | "Difference +3 points" in Success | "Visited (30d)
3,480" | "Enrolled (30d) 312".

SIDE-BY-SIDE FUNNELS — the primary object, two equal columns (the one place a 50/50 split is
correct, because the two are peers being compared):
LEFT "All time" and RIGHT "Last 30 days", each a three-stage vertical funnel — Visited, Started
diagnostic, Enrolled — drawn as descending horizontal bars scaled within their own column, each
bar labelled with its stage name on the left and its count in 20px monospace on the right, with
a stage-to-stage conversion percentage on the connector between each pair of bars and a drop-off
count beside it in Muted Ink ("16,280 did not start a diagnostic").
Between the two columns, a slim centre gutter carries per-stage comparison markers: for each
stage, a small monospace delta showing how the 30-day conversion at that step differs from
all-time, tinted Success or Warning.

STAGE DETAIL — beneath the funnels, one table: Stage | All-time count | All-time step conversion
| 30-day count | 30-day step conversion | Difference (signed, tinted) | a chevron to the report
behind that stage. Three rows, one per stage. A caption states which step is leaking most.

DROP-OFF PANEL — a full-width panel titled "Where the pipeline leaks": two horizontal bars, one
per transition (Visited → Started diagnostic, Started diagnostic → Enrolled), each showing the
proportion retained in Accent Indigo and the proportion lost in a hollow Outline track, labelled
with both counts and the retention percentage, and a plain sentence naming the bigger leak in
absolute terms.

ALSO PRODUCE: the zero-pipeline variant where visited is zero — both funnels render as hollow
tracks, every conversion cell shows an em dash with the caption "No pipeline events recorded",
and a Sunken Surface strip explains that pipeline stages come from analytics events and links to
where that is configured; a loading skeleton; and a 390px mobile frame where the two funnels
stack vertically with the comparison markers moving into each stage row as inline deltas.
```

---

## Screen 4 — `/admin/insights/sales-insight/attribution`

```text
Screen: Attribution. Route /admin/insights/sales-insight/attribution. The "Top attribution
sources" widget expanded into the screen that answers "which channels are worth more money".

HEADER
Breadcrumb: Admin / Insights / Sales Insight / Attribution. Title "Attribution", subtitle "Which
sources bring events, and what revenue is attributed to them." Right: secondary "Copy as CSV",
secondary "Export", primary "Open Reports → Sales & Marketing".

METHOD CAVEAT — a Sunken Surface strip beneath the header, one line in Muted Ink: "Attributed
revenue is credited to the source recorded on the learner's first tracked event. A learner with
no tracked source appears under Direct." Not dismissible, present on every state.

HEADLINE BAND (unequal cells, first double width): "Attributed revenue 24,18,900.00 INR" at 32px
monospace with the caption "57.8% of total revenue" and a 3px bar | "Events 84,120" | "Sources
18" with the caption "6 above 1% of revenue" | "Revenue per event 28.75 INR" | "Unattributed
17,67,300.00 INR" in Warning with the caption "no source recorded".

SOURCE COMPOSITION — a full-width panel: one horizontal stacked band across the content width
split by source in descending revenue order, in graded tints of Accent Indigo with the leader in
the full accent, each segment labelled with its source and share, and a trailing Muted segment
for unattributed revenue. An inline legend row beneath doubles as a filter for the table.

TWO PANELS side by side, asymmetric 58/42:
LEFT: "Events against revenue" — a scatter plot with events on the x-axis and attributed revenue
on the y-axis, one point per source labelled with its slug in monospace, a diagonal reference
line at the overall revenue-per-event rate, and quadrant captions in Muted Ink at the corners:
"High volume, low value" and "Low volume, high value". A caption names the source furthest above
the line.
RIGHT: "Revenue per event" — a ranked list of sources with the rate in monospace and a 3px bar,
ordered descending, so efficiency reads separately from raw volume.

SOURCE TABLE — the detail: [checkbox] | Source (monospace, since these are slugs) | Events
(monospace with a 3px share bar) | Attributed revenue (monospace with the currency code and its
own share bar) | Share of revenue (percentage) | Revenue per event (monospace) | a chevron to
the Sales & Marketing report filtered to that source. Sorted by attributed revenue descending.
Show 10 rows including one high-volume low-value source and one low-volume high-value source
carrying a small Muted Ink caption naming the pattern.

ALSO PRODUCE: the empty state — "No attribution events recorded", a sentence explaining that
sources come from tracked visits and a link to where tracking is configured, with the caveat
strip still present; a loading skeleton; and a 390px mobile frame where the scatter is replaced
by the revenue-per-event ranked list with a caption saying the scatter needs a wider screen.
```

---

## Screen 5 — `/admin/insights/sales-insight/opportunity`

```text
Screen: Conversion opportunity. Route /admin/insights/sales-insight/opportunity. The five-segment
widget expanded into the screen an operator uses to decide who to convert next.

HEADER
Breadcrumb: Admin / Insights / Sales Insight / Opportunity. Title "Conversion opportunity",
subtitle "Who is enrolled but not paying, and how they got there." Right: secondary "Export",
primary "Open Reports → Enrollments".

OVERLAP CAVEAT — a Sunken Surface strip beneath the header, one line in Muted Ink: "Online is a
rollup of paid, free, and trial. These segments overlap and do not sum to the learner total."
Not dismissible, present on every state — it is the reason this screen has no pie chart anywhere.

HEADLINE BAND (unequal cells, first double width): "Trial + free pool 2,186" at 32px monospace
in Warning with the caption "learners enrolled without paying" and a 3px bar against total
enrolments | "Paid enrollments 3,412" in Success | "Trial 842" | "Free 1,344" | "Offline /
manual 218" with the caption "granted outside checkout".

SEGMENT BLOCKS — five full-width Panel Surface blocks in the widget's fixed order, laid out
identically so they read as a set. Each block:
LEFT — the count at 32px monospace with the segment name above in 12px/600 uppercase Muted Ink,
and its share of total enrolments beneath as a percentage with a 3px bar.
MIDDLE — one or two plain sentences on what the segment is and what could be done with it, plus
a small evidence row of monospace chips.
RIGHT — the action, as a primary button plus an optional secondary.
The five blocks:
1. "Paid enrollments" — 3,412 — Success figure — "Already converted. Shown for scale." — chips
   "avg 3,262.00 INR", "12 products" — action "Open Payments" secondary only, no primary,
   because there is nothing to convert.
2. "Trial enrollments" — 842 — Warning figure — "In a trial that has not converted. The highest-
   intent pool on this screen." — chips "218 expiring in 7 days", "84 already lapsed" — actions
   "Message trial learners" primary, "Open Enrollments" secondary.
3. "Free enrollments" — 1,344 — Warning figure — "Enrolled on a free product. Lower intent, but
   the largest pool." — chips "412 active in 30 days", "932 dormant" — actions "Message active
   free learners" primary, "Open Enrollments" secondary.
4. "Offline / manual" — 218 — neutral figure, no tint — "Granted outside checkout, so no payment
   record exists. Excluded from conversion rate." — chips "granted by 4 admins" — action "Open
   Enrollments" secondary only. A caption states plainly that these never appear in the pipeline.
5. "Online (paid + free + trial)" — 5,598 — Muted figure — "A rollup of the three segments
   above, shown because the payload includes it." — no chips, no action, and a caption repeating
   that it double-counts the rows above.

SEGMENT MIX PANEL — beneath the blocks, full width: a single horizontal stacked band of only the
three non-overlapping segments — paid, trial, free — each labelled with its count and share, plus
a separate detached bar for offline/manual set apart by a gap and its own label, so the overlap
rule is respected visually. The Online rollup is deliberately absent from this chart, with a
caption saying why.

ALSO PRODUCE: the all-paid state where trial and free are both zero — those two blocks collapse
to a single line each with a Success marker reading "No unconverted trial learners" and "No free
enrolments", while paid and offline stay full size; a loading skeleton; and a 390px mobile frame
where each block stacks its three regions with the action button full width.
```

---

## Screen 6 — `/admin/insights/sales-insight/alerts`

```text
Screen: Alerts. Route /admin/insights/sales-insight/alerts. Scoped to this section's three rules
— and the only insights section that can produce a critical.

HEADER
Breadcrumb: Admin / Insights / Sales Insight / Alerts. Title "Alerts", subtitle "What Sales
Insight is flagging, and the thresholds behind it." Right: secondary "Export CSV", secondary
"View all insight alerts", primary "Mark all as seen".

SUMMARY BAND (unequal cells, first double width): "Open alerts 3" at 32px monospace with the
caption "1 critical · 1 warning · 1 info" and a three-segment composition bar | "Critical 1" in
Danger, clickable to filter | "New since yesterday 1" | "Resolved this week 4" in Success |
"Rules 3" with the caption "all thresholds configurable".

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN: full-width strips matching the section's own alert rendering exactly, grouped under
hairline severity headers with counts, critical first. Each strip: severity-tinted background,
title at 15px/600, message beneath, and on the right a first-seen timestamp in monospace, a
chevron where an href exists, and a kebab (Open the linked page, Mute for 1 day, Mute for 7 days,
Mute forever, Mark as resolved, Copy alert id) — the three mute durations matching the real enum.
Show the three alerts from Screen 1, with the critical strip given the full Danger treatment so
it is unmistakably different from a warning.

TAB 2 — RESOLVED: a dense table: Alert (title with message truncated beneath) | Severity pill |
Rule id in 10px monospace | First seen | Resolved (relative + absolute) | Resolved by (a name, or
"Automatically" in Muted Ink) | Duration open (monospace) | kebab. Six rows, including one that
escalated from warning to critical and back — its severity cell shows both with an arrow between
them and a caption "escalated then cleared".

TAB 3 — MUTED: the same table plus "Muted until" in Warning, with "Forever" as a plain word, an
"Unmute" text button per row, and a caption above explaining that muting hides the alert but
does not change the condition. A Warning strip sits at the top of this tab specifically for this
section: "Muting failed payments hides a revenue-affecting signal. Consider raising the
threshold instead."

TAB 4 — RULES: one Panel Surface block per rule, all three and no more:
  - "Failed payments" — a "Severity it can produce" chip row showing Warning and Critical — the
    condition stated plainly ("Raise a warning on any failed payment; escalate to critical at N
    or more"), a numeric threshold control with a live caption showing what the current data
    would produce at that threshold, an enabled toggle, and a last-fired caption.
  - "Pending orders" — Info only — the condition, a numeric threshold, enabled toggle.
  - "Low conversion (30d)" — Warning only — the condition, a percentage threshold control with a
    caption naming the current 30-day rate against it, enabled toggle.

ALSO PRODUCE: the all-clear empty state for Open — line-art level line, "Nothing is flagged in
Sales Insight", the sentence "Alerts appear here when one of the three rules fires.", secondary
"View rules"; the mute-confirmation modal, with the failed-payments variant carrying the extra
revenue warning; a loading skeleton; and a 390px mobile frame.
```

---

## Not duplicated here

Four screens in this module are structurally identical to ones already specified — build them
once as shared components and scope them by slug:

- **Customize** (`/admin/insights/sales-insight/customize`) — same layout editor as
  [School Vitals Screen 6](./stitch-school-vitals-prompts.md), with this section's twelve KPIs in
  three groups and nine widgets. One difference worth carrying: because Sales Insight widgets
  have no deltas or sparklines, the customize canvas should not offer any delta-related control.
- **Digests** (`/admin/insights/sales-insight/digests`) — same as School Vitals Screen 7, with
  the contents checklist mirroring this section's widget order and the range selector omitted,
  since the section's windows are fixed.
- **Widget library** (`/admin/insights/sales-insight/library`) — the tenant-wide catalogue with
  this section preselected.
- **Settings** (`/admin/insights/sales-insight/settings`) — tenant-wide; Sales Insight is one
  row in its access table, and the row should carry the "Contains personal data" marker because
  the failed-payments widget exposes learner names.

---

## Backend gaps these prompts assume

| Prompt feature                                                                                                    | Status                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section endpoint returning the twelve KPIs and nine widgets, exact titles and order                               | exists                                                                                                                                                                                                                                        |
| Conversion rate computed as enrolled ÷ visited, whole-number rounded, zero-safe                                   | exists                                                                                                                                                                                                                                        |
| Three-stage pipeline for both all-time and 30-day windows                                                         | exists                                                                                                                                                                                                                                        |
| Enrollments by channel, orders by status, top products, top sources, opportunity segments, recent failed payments | exists                                                                                                                                                                                                                                        |
| The three sales-insight alert rules, with failed-payments escalating warning → critical                           | exists                                                                                                                                                                                                                                        |
| Alert mute (1d / 7d / forever), resolve, persisted alert state                                                    | exists                                                                                                                                                                                                                                        |
| Saved layout, widget detail endpoint, library, settings, digests per slug                                         | exist                                                                                                                                                                                                                                         |
| Widget detail `failureRate` block — used by the failed-payments widget on Screen 2                                | exists                                                                                                                                                                                                                                        |
| **Range support for this section**                                                                                | **missing** — `buildSalesInsightWidgets` takes no range, which is why the addendum disables the control rather than faking it. Bringing it in line with School Vitals means threading `range` through and retitling the fixed-window widgets. |
| **Deltas and sparklines on Sales Insight KPIs**                                                                   | **missing** — no `deltaPct`, `deltaAbs`, or `sparkline` on any widget in this builder                                                                                                                                                         |
| Stage-to-stage conversion percentages and drop-off counts on the pipeline                                         | derivable from the three stage counts client-side; not returned                                                                                                                                                                               |
| Unattributed revenue figure and revenue-per-event rate on the attribution screen                                  | needs backend — the sources payload carries events and revenue per source only                                                                                                                                                                |
| Trial expiry and lapsed counts, dormant free-learner counts (the opportunity evidence chips)                      | needs backend                                                                                                                                                                                                                                 |
| Messaging actions from the opportunity segments                                                                   | needs backend; the pattern exists in the report modules                                                                                                                                                                                       |

One correctness note carried into the addendum: `salesConversionRate` returns 0 when visited is
zero. The design shows an em dash with an explanatory caption instead, because a rendered "0%"
would read as a catastrophic conversion failure rather than an absence of pipeline data — worth
matching in the frontend rather than passing the raw 0 through.
