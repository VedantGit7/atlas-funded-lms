# Google Stitch Prompts — Marketing Insight (`/admin/insights/marketing-insight`)

Paste **Block 0 (Design System)**, then **Block 0-ID (Insights module addendum)**, then
**Block 0-MI (Marketing Insight addendum)**, then one screen prompt per generation.

Block 0 and Block 0-ID are unchanged from
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) — if you are
already in that Stitch project, skip straight to Block 0-MI.

Source of truth:

- `backend/apps/api/src/server/insights/insights.service.ts`
  (`buildMarketingInsightWidgets`, `marketingInsightAlertMetrics`, `ctaClickRate`)
- `backend/apps/api/src/server/insights/insights-alerts.ts` (the two marketing-insight rules)
- `backend/apps/api/src/server/insights/insights.schemas.ts` (widget, layout, alert contracts)

**Three things to know before designing.** First, like Sales Insight and Live Dashboard,
`buildMarketingInsightWidgets` takes only the snapshot — no `range`, no deltas, no sparklines.
Second, this is the **largest section in the module**: sixteen KPIs and ten widgets, six of them
consecutive half-span tables, which is a real layout problem the addendum solves rather than
ignores. Third, it is the only section whose alert rules produce **warnings and nothing else** —
no info, no critical.

**How this overlaps Sales Insight.** Both sections read the same attribution events. Sales
Insight asks "which sources produced revenue" as part of the revenue story; Marketing Insight
asks "how are our capture surfaces performing" and splits attribution three ways — source,
medium, and UTM campaign. Where the two show the same figure it must agree exactly; cross-link
rather than re-explain.

---

## Block 0-MI — Marketing Insight addendum (paste third)

```text
MARKETING INSIGHT SECTION ADDENDUM — applies to every screen under
/admin/insights/marketing-insight

WHAT THIS SECTION ANSWERS
How the top of the funnel is performing: where traffic is attributed from, how many leads the
forms and CTAs capture, which campaigns and coupons pull, and whether the automation is running.
It stops at the lead. Revenue belongs to Sales Insight, and the two share the same attribution
events — where a figure appears in both, it must match exactly.

THIS SECTION DOES NOT RESPOND TO THE RANGE CONTROL
Windows are fixed in widget titles — "(30d)" — and the section is built from a snapshot with no
range parameter. Keep the range control visible for consistency but render it disabled with the
Muted Ink caption "Marketing Insight uses fixed windows shown in each widget title". Never hide
it, never let it look active. Repeat the caption once beneath the KPI region.

NO DELTAS IN THIS SECTION
No widget carries deltaPct, deltaAbs, or a sparkline. KPI cards render label and value only.
Where a comparison exists it is an adjacent KPI pair — all-time beside 30-day — and those pairs
must sit next to each other so the comparison is read across two cards.

SIXTEEN KPIs IS TOO MANY FOR ONE WALL — GROUP THEM IN FOUR
Exactly these, in exactly this order, all span third:
Attribution events · Attribution events (30d) · Attributed revenue · Contacts · Contacts (30d) ·
Form submissions · Submissions (30d) · Live forms · Live CTAs · CTA views · CTA clicks ·
CTA click rate % · Published workflows · Workflow runs (30d) · Coupon redemptions ·
Event registrations.
Render them under four hairline sub-headers, four cards each:
  "Attribution" — Attribution events, Attribution events (30d), Attributed revenue, Contacts
  "Capture" — Contacts (30d), Form submissions, Submissions (30d), Live forms
  "Engagement" — Live CTAs, CTA views, CTA clicks, CTA click rate %
  "Automation and offers" — Published workflows, Workflow runs (30d), Coupon redemptions,
  Event registrations
Attributed revenue uses the dashboard currency and always shows the code. CTA click rate % is a
whole-number percentage with a trailing % and a 3px bar; where CTA views are zero it shows an em
dash with the caption "No CTA views recorded", never 0%.

"LIVE" MEANS PUBLISHED AND COLLECTING — SAY IT ONCE
Three KPIs count only live assets — Live forms, Live CTAs, Published workflows — while the
inventory widget counts both all and live. Add one Muted Ink caption beneath the KPI region:
"Live counts only published assets that can currently collect. The inventory widget shows both
totals." Never tint a low live-count as a problem; a tenant may deliberately run few.

SIX CONSECUTIVE HALF-SPAN TABLES — PAIR THEM, DO NOT STACK THEM BLINDLY
Widgets 4 through 9 are all half-span tables, which would otherwise read as a featureless grid.
Pair them by subject with a hairline group label above each pair, so the grid has rhythm:
  "Where traffic came from" — Top sources (with revenue) + Top UTM campaigns
  "What captured it" — Top forms by submissions + Top CTAs by engagement
  "What was offered" — Top coupons by redemptions + Marketing inventory
Within a pair, the two tables share row height and column alignment so the eye can scan across.
These labels are layout scaffolding, not widget titles — keep each widget's own title inside its
frame.

"DAILY LEADS (30D)" CARRIES TWO SERIES AND THEY ARE NOT THE SAME THING
The payload has submissions and contacts per day. A submission is a form completion; a contact
is a person record. One person submitting twice is two submissions and one contact, so the
series can diverge and the gap is meaningful, not an error. Draw submissions as a solid Accent
Indigo line and contacts as a lighter line, inline legend above the plot, and carry a mandatory
caption: "Submissions count form completions; contacts count people. One person can submit more
than once." Never merge them, never shade between them as if it were a funnel gap.

ATTRIBUTION IS SPLIT THREE WAYS — KEEP THE DIMENSIONS DISTINCT
Source (where they came from, e.g. "google", "instagram"), medium (how, e.g. "organic", "cpc",
"referral"), and UTM campaign (which push, e.g. "aug-intake-2026"). These are three different
dimensions over the same events, so the same total appears three ways. Never present them as if
they sum together, and never combine source and medium into one "channel" label unless the
payload already did. Render every source, medium, and campaign value in monospace, because they
are slugs an operator will copy into a URL.

MONEY RENDERING
Attributed revenue and discount given are major-unit figures already converted from cents.
Monospace, right-aligned in tables, decimals aligned, currency code as an 11px Muted Ink suffix:
"1,84,600.00 INR". Never a bare glyph.

ASSET STATUS VALUES COME FROM THE DATA
Form status, CTA status, CTA type, and workflow-run status all render whatever the payload
contains, in its own order. Tint only what is unambiguous — anything reading "live" or
"published" or "succeeded" in Success, "failed" in Danger, "draft" or "paused" in Muted — and
leave the rest neutral. Never assume a fixed status set.

THE TWO ALERT RULES — exactly these, and both are warnings
no-form-submissions-30d (warning) · low-cta-click-rate (warning).
This is the only insights section whose rules produce a single severity. So the alert stack here
is homogeneous by design: never design an info strip or a Danger strip for this section, and do
not draw a three-segment severity composition bar where only one segment can ever be non-zero.

DATA REALISM FOR THIS SECTION
Sources like "google", "instagram", "direct", "partner-rd". Mediums like "organic", "cpc",
"referral", "email". Campaigns like "aug-intake-2026", "risk-desk-launch", "reactivation-q3".
Form titles like "Free strategy call", "Foundations waitlist". CTA titles like "Book a call",
"Start the diagnostic". Coupon codes in monospace uppercase: "SUMMER15", "LAUNCH2026". Counts
like 84,120 events, 3,412 contacts, 1,284 submissions, 42,180 CTA views, 2,140 clicks. Rates
like 5%. Revenue like 24,18,900.00 INR.
```

---

## Screen 1 — `/admin/insights/marketing-insight` (the section)

```text
Screen: Insights — Marketing Insight. Route /admin/insights/marketing-insight. Desktop 1440px,
admin sidebar with "Insights" expanded and "Marketing Insight" active.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight. Title "Marketing Insight", subtitle "Where
traffic is attributed from, what captures it, and whether the automation is running." Right
side: the range segmented control rendered DISABLED with the Muted Ink caption "Marketing
Insight uses fixed windows shown in each widget title" beside it, a secondary "Customize"
button, a secondary "Export" button, and a primary "Refresh" with a "Generated 4 minutes ago"
caption beneath it.

MODULE TAB STRIP: Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing
Insight · Messenger Insight, with "Marketing Insight" active.

ALERT STACK — beneath the tab strip. This section produces warnings only, so render exactly two
Warning strips and nothing else — no info strip, no critical strip anywhere on the screen:
  - Warning: "No form submissions (30d) — no form has been submitted in the last 30 days across
    4 live forms." with a chevron link.
  - Warning: "Low CTA click rate — 5% of CTA views converted to clicks, below your 8%
    threshold." with a chevron link.

KPI REGION — sixteen cards in a four-column grid under four hairline sub-headers, four cards per
row, label and value only, no deltas or sparklines:
"Attribution" — Attribution events (84,120), Attribution events (30d) (12,480), Attributed
revenue (24,18,900.00 INR), Contacts (3,412).
"Capture" — Contacts (30d) (486), Form submissions (1,284), Submissions (30d) (0, rendered
plainly with no Warning tint on the card itself since the alert already carries that signal),
Live forms (4).
"Engagement" — Live CTAs (7), CTA views (42,180), CTA clicks (2,140), CTA click rate % (5% with
a 3px bar).
"Automation and offers" — Published workflows (6), Workflow runs (30d) (218), Coupon redemptions
(418), Event registrations (642).
Beneath the region, two Muted Ink captions: the fixed-window note, and the "Live counts only
published assets that can currently collect" note.

WIDGET GRID — two-column, in the exact order below, with the three pair labels from the addendum
rendered as hairline group headers spanning both columns:
1. "Attribution by source" — half — horizontal bars, one per source from the payload, source
   slugs in monospace, counts in monospace, largest in full Accent Indigo and the rest at 60%
   tint.
2. "Attribution by medium" — half — the identical bar treatment over mediums, positioned beside
   widget 1, with a shared caption beneath the pair: "The same events, split two ways. Totals
   match; the breakdowns do not add together."
3. "Daily leads (30d)" — full — a dual-series line chart: submissions as a solid Accent Indigo
   line, contacts as a lighter line, inline legend above, no shading between them, a dashed line
   at the 30-day mean submissions, and the mandatory caption from the addendum beneath.
Group header "Where traffic came from":
4. "Top sources (with revenue)" — half — a table: Source (monospace) | Events (monospace with a
   3px share bar) | Attributed revenue (monospace with the currency code and its own share bar).
   Six rows.
5. "Top UTM campaigns" — half — a table: Campaign (monospace) | Events | Attributed revenue.
   Six rows, aligned row-for-row with the table beside it.
Group header "What captured it":
6. "Top forms by submissions" — half — a table: Form (title in Accent Indigo) | Status pill |
   Submissions (monospace with a 3px share bar). Five rows.
7. "Top CTAs by engagement" — half — a table: CTA (title in Accent Indigo) | Type chip | Status
   pill | Views (monospace) | Clicks (monospace, with a small click-rate percentage beneath each
   clicks figure in 11px Muted Ink). Five rows.
Group header "What was offered":
8. "Top coupons by redemptions" — half — a table: Code (monospace uppercase with a copy icon) |
   Name | Redemptions (monospace) | Discount given (monospace with the currency code). Five rows.
9. "Marketing inventory" — half — a table of the ten asset rows in their fixed order: Forms
   (all), Forms (live), CTAs (all), CTAs (live), Workflows (published), Campaigns (launched),
   Email campaigns sent, Active coupons, Events, Event registrations (30d) — Asset | Count
   (monospace). The all/live pairs sit adjacent with a hairline between each pair group.
10. "Recent workflow runs" — full — a table: Workflow (title in Accent Indigo) | Status pill |
    Trigger (the event type in monospace) | Created (date and time in monospace). Eight rows
    including one failed run carrying a Danger left rail.

ALSO PRODUCE as separate frames:
A. Loading — two shimmer alert strips, sixteen KPI shimmer cards keeping all four group headers,
   each widget frame skeletoned to its default visualization with the pair group headers intact.
B. Empty — a tenant with no marketing activity: every KPI zero, CTA click rate showing an em
   dash with "No CTA views recorded", and all ten widgets in their own empty states with
   widget-specific sentences ("No attribution events recorded", "No forms published yet").
C. No alerts — the stack absent with no reserved space.
D. Error — an inline Danger strip replacing the widget grid, KPIs retained.
E. Mobile 390px — module tabs scroll horizontally, KPIs two-up with all four group headers
   intact, pair group headers retained above each stacked pair, every widget full width, all
   tables scrolling horizontally inside their own frames.
```

---

## Screen 2 — `/admin/insights/marketing-insight/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/marketing-insight/widgets/[widgetId]. The expanded
view of one widget, backed by the widget detail endpoint. Produce a full page and a full-screen
overlay variant over the section.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight / Daily leads (30d). Title: the widget title.
Beneath it the server-supplied description as a Muted Ink sentence, and the widget id in 10px
monospace with a copy icon. Right: a full labelled visualization segmented control showing only
compatible types with the server default marked; a secondary "Copy as CSV"; a secondary
"Export"; and a primary "Open the full report" driven by the endpoint's related links. No range
control — the window is fixed and stated in the title.

HEADLINE STRIP — from the endpoint's comparison block: current value at 32px monospace with its
currentLabel beneath, previous value with its previousLabel, absolute delta, percentage delta
tinted Success or Warning by direction, then the endpoint's average as its own cell. A null
comparison shows the current value alone with "No comparable previous period".

CHART PANEL — the widget at full width and about 420px tall with axis labels, a legend row that
toggles series, hover tooltips reading both series at once for the dual-series widget, a dashed
line at the endpoint's average, and a brush strip for zooming. For "Daily leads (30d)" the
submissions-versus-contacts caption from the addendum is carried through at this size. Beneath
the chart, the endpoint's insightNote in a Sunken Surface strip — "Submissions and contacts
diverged from 8 August, suggesting repeat submissions from the same people."

SPLITS — a "Split by" segmented control from the endpoint's splitOptions, redrawing the chart
with an inline legend, plus a split table for the active option: Label (monospace where the
dimension is a slug) | Value (monospace, with the currency code where the measure is money) |
Share (percentage with a 3px bar), sorted descending. Where splitOptions is empty, one Muted Ink
line replaces the region.

UNDERLYING DATA — a Sunken Surface panel behind a "Show underlying data" toggle, expanding to
the exact normalized payload with each column's kind as a 10px monospace marker in the header,
every row, right-aligned measures, and a footer with the row count and a "Copy as CSV" button.

RELATED — a right rail at 32% with the endpoint's related array as rows: title, one-line
description, chevron, and the icon type as a small Muted Ink marker.

ALSO PRODUCE: the bar-widget variant for the two attribution widgets, where the chart is a
full-width bar chart with a "Show the other dimension" toggle that swaps between source and
medium and a caption reminding that the two do not add together; the table-widget variant where
the chart panel becomes the full sortable, searchable, paginated table and the underlying-data
panel is dropped; a loading skeleton; an empty variant; and a 390px mobile frame where the
related rail stacks beneath and the brush strip is dropped.
```

---

## Screen 3 — `/admin/insights/marketing-insight/attribution`

```text
Screen: Attribution. Route /admin/insights/marketing-insight/attribution. The three attribution
dimensions given one screen, because comparing them is the job.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight / Attribution. Title "Attribution", subtitle
"The same events split by source, medium, and UTM campaign." Right: secondary "Copy as CSV",
secondary "Export", primary "Open Sales Insight → Attribution" with a Muted Ink caption noting
that the revenue-side view of the same events lives there.

METHOD CAVEAT — a Sunken Surface strip beneath the header, one line in Muted Ink: "Source,
medium, and campaign are three dimensions over the same attribution events. Each breakdown sums
to the same total; they do not add to each other. Events with no value recorded appear under
Direct or Not set." Not dismissible, present on every state.

HEADLINE BAND (unequal cells, first double width): "Attribution events 84,120" at 32px monospace
with the caption "12,480 in the last 30 days" | "Attributed revenue 24,18,900.00 INR" | "Sources
18" | "Mediums 6" | "Campaigns 24" with the caption "9 with recorded revenue".

DIMENSION TABS — a segmented control: Source · Medium · Campaign. The body below swaps
entirely; the caveat strip and headline band stay fixed. Produce the Source tab as the primary
frame and the Campaign tab as a second frame.

BODY, per dimension:
COMPOSITION — a full-width panel: one horizontal stacked band across the content width split by
the active dimension in descending event order, graded tints of Accent Indigo with the leader in
full accent, each segment labelled with its value in monospace and its share, plus a trailing
Muted segment for "Not set" where the payload carries one. An inline legend beneath doubles as a
filter for the table.

TWO PANELS side by side, asymmetric 58/42:
LEFT: "Events against revenue" — a scatter with events on the x-axis and attributed revenue on
the y-axis, one point per value labelled with its slug in monospace, a diagonal reference line
at the overall revenue-per-event rate, and quadrant captions in Muted Ink: "High volume, low
value" and "Low volume, high value". A caption names the value furthest above the line.
RIGHT: "Revenue per event" — a ranked list with the rate in monospace and a 3px bar, ordered
descending, so efficiency reads separately from raw volume. A Muted Ink caption warns that
values with very few events produce unstable rates, and any row below a small event count is
rendered at reduced emphasis.

DETAIL TABLE — [checkbox] | Value (monospace, with a copy icon) | Events (monospace with a 3px
share bar) | Share of events (percentage) | Attributed revenue (monospace with the currency code
and its own share bar) | Share of revenue (percentage) | Revenue per event (monospace) | a
chevron to Sales & Marketing filtered to that value. Sorted by events descending. Show 10 rows
including one high-volume low-value and one low-volume high-value row, each carrying a small
Muted Ink caption naming the pattern.

CROSS-DIMENSION PANEL — beneath, only on the Source tab: a compact matrix with sources down the
left and mediums across the top, cells holding event counts in monospace on a background tinted
by value, with pinned totals on the trailing row and column. A caption names the strongest pair:
"google / organic accounts for 34% of all attributed events." Where the payload cannot support
the cross-tab, this panel is replaced by a single Muted Ink line saying so rather than an empty
grid.

ALSO PRODUCE: the empty state — "No attribution events recorded", a sentence on where tracking
is configured, the caveat strip retained; a loading skeleton; and a 390px mobile frame where the
scatter is dropped with a caption saying it needs a wider screen, the cross-dimension matrix is
replaced by a top-pairs list, and the detail table becomes stacked cards.
```

---

## Screen 4 — `/admin/insights/marketing-insight/capture`

```text
Screen: Capture. Route /admin/insights/marketing-insight/capture. Forms and CTAs — the two
surfaces that turn traffic into leads — on one screen, because the click rate connects them.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight / Capture. Title "Capture", subtitle "How forms
and CTAs are performing, and where the drop happens." Right: secondary "Copy as CSV", secondary
"Export", primary "Manage forms and CTAs" linking to the marketing authoring screens.

HEADLINE BAND (unequal cells, first double width): "CTA click rate 5%" at 32px monospace with a
3px bar and the caption "2,140 clicks of 42,180 views" | "Form submissions 1,284" with the
caption "0 in the last 30 days" in Warning | "Live forms 4 of 9" | "Live CTAs 7 of 14" |
"Contacts created 3,412".

THE CAPTURE CHAIN — a full-width panel, the primary object: a four-step horizontal chain drawn
as descending bars — CTA views 42,180 → CTA clicks 2,140 → Form submissions 1,284 → Contacts
created 3,412 — with the step-to-step rate on each connector. Because the last step is larger
than the one before it, the chain must carry a mandatory Muted Ink caption rather than looking
broken: "Contacts include people captured outside these forms, so the final step can exceed the
one before it. This is a chain of related measures, not a strict funnel." The step where the
largest absolute drop occurs is marked with a Warning bracket and named in a second caption.

TWO PANELS side by side, asymmetric 50/50 — permitted here because forms and CTAs are peers:
LEFT "Forms" — a table: Form (title in Accent Indigo) | Status pill | Submissions (monospace
with a 3px share bar) | Submissions (30d) (monospace, Warning-tinted where zero) | Last
submission (relative + absolute, or "Never" in Warning) | a chevron. Eight rows including two
live forms with zero submissions in 30 days carrying a Warning rail, and two draft forms at
reduced emphasis. A caption above states that only live forms can collect.
RIGHT "CTAs" — a table: CTA (title in Accent Indigo) | Type chip | Status pill | Views
(monospace) | Clicks (monospace) | Click rate (percentage with a 3px bar; Warning tint below the
alert threshold; an em dash with "No views recorded" where views are zero) | a chevron. Eight
rows spanning several CTA types.

BENEATH — "Click rate by CTA type": horizontal bars, one per CTA type present in the payload,
each showing that type's aggregate click rate with its view count in monospace beside it, a
dashed vertical line at the tenant's overall rate, and a caption naming the best and worst type.
Types with very few views are rendered at reduced emphasis with a caption warning that the rate
is unstable.

ALSO PRODUCE: the no-capture state where both forms and CTAs are empty — the chain replaced by a
line-art mark with "No capture surfaces published yet" and a primary "Create a form"; the
zero-submission state matching the live alert, where the forms table shows live forms with zero
30-day submissions and a Warning strip above it repeats the alert message; a loading skeleton;
and a 390px mobile frame where the two peer tables stack and the chain becomes four stacked rows
with the rates as inline captions.
```

---

## Screen 5 — `/admin/insights/marketing-insight/workflows`

```text
Screen: Workflows. Route /admin/insights/marketing-insight/workflows. The automation view —
what is published, what has been running, and what failed.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight / Workflows. Title "Workflows", subtitle "What
the marketing automation has been doing." Right: secondary "Copy as CSV", secondary "Export",
primary "Manage workflows".

HEADLINE BAND (unequal cells, first double width): "Runs (30d) 218" at 32px monospace with the
caption "across 6 published workflows" | "Published workflows 6" | "Failed runs 9" in Warning,
clickable to filter | "Success rate 95.9%" with a 3px bar | "Last run 14 minutes ago".

RUN VOLUME — a full-width panel: bars per day over the last 30 days showing run counts, with
failed runs stacked in Warning on top of successful runs in Accent Indigo, an inline legend
above, and a caption naming the busiest day and any day with an unusual failure share. Days with
no runs render as a hollow tick rather than a zero bar.

TWO PANELS side by side, asymmetric 58/42:
LEFT: "Runs by workflow" — a table: Workflow (title in Accent Indigo) | Status pill | Runs (30d)
(monospace with a 3px share bar) | Failed (monospace, Warning-tinted where non-zero) | Success
rate (percentage with a bar) | Last run (relative + absolute) | a chevron. Six rows, one with a
notably high failure share carrying a Warning rail.
RIGHT: two stacked panels —
1. "Triggers" — a ranked list of trigger event types in monospace with their run counts and a
   3px share bar, so an operator can see what is actually firing the automation.
2. "Published but never run" — a short list of published workflows with zero runs in the window,
   each with its publish date and a chevron, under a caption explaining that a published
   workflow with no runs usually means its trigger has not occurred. An empty variant reads
   "Every published workflow has run in this window."

RUN LEDGER — beneath, the full table: Workflow (title in Accent Indigo) | Status pill | Trigger
(event type in monospace) | Created (date and time in monospace) | a kebab (Open workflow, View
run, Copy run id). Failed rows carry a Danger left rail with the first line of the error where
the payload carries one. A filter bar above offers a workflow combobox, a status multi-select
built from the payload's own values, a trigger combobox, and a date range. Twelve rows.

ALSO PRODUCE: the no-automation state — every panel replaced by a single centred block with a
line-art mark, "No workflows published", two sentences on what marketing automation does, and a
primary "Manage workflows"; the all-healthy state where failed runs are zero and the volume
chart shows no Warning segment at all, with a Success caption; a loading skeleton; and a 390px
mobile frame where the right rail stacks beneath and the ledger becomes cards.
```

---

## Screen 6 — `/admin/insights/marketing-insight/alerts`

```text
Screen: Alerts. Route /admin/insights/marketing-insight/alerts. Scoped to this section's two
rules — and this section produces warnings only.

HEADER
Breadcrumb: Admin / Insights / Marketing Insight / Alerts. Title "Alerts", subtitle "What
Marketing Insight is flagging, and the thresholds behind it." Right: secondary "Export CSV",
secondary "View all insight alerts", primary "Mark all as seen".

SUMMARY BAND (unequal cells, first double width): "Open alerts 2" at 32px monospace with the
caption "both warnings" — and NO severity composition bar at all, because a single-severity
section cannot fill one and an all-one-colour bar conveys nothing | "New since yesterday 1" |
"Resolved this week 3" in Success | "Muted 0" | "Rules 2" with the caption "both warnings, both
thresholds configurable".

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN: full-width Warning strips matching the section's own alert rendering exactly. With
only one severity there are no severity group headers — instead group by rule with a hairline
header per rule and its count. Each strip: Warning-tinted background, title at 15px/600, message
beneath, and on the right a first-seen timestamp in monospace, a chevron where an href exists,
and a kebab (Open the linked page, Mute for 1 day, Mute for 7 days, Mute forever, Mark as
resolved, Copy alert id) — the three mute durations matching the real enum. Show the two alerts
from Screen 1.

TAB 2 — RESOLVED: a dense table: Alert (title with message truncated beneath) | Rule id in 10px
monospace | First seen | Resolved (relative + absolute) | Resolved by (a name, or "Automatically"
in Muted Ink where the condition cleared) | Duration open (monospace) | kebab. The severity
column is omitted entirely rather than repeating "Warning" on every row — state it once in a
caption above the table. Five rows.

TAB 3 — MUTED: the same table plus "Muted until" in Warning with "Forever" as a plain word, an
"Unmute" text button per row, and a caption explaining that muting hides the alert but does not
change the condition. An empty variant reads "No muted rules in Marketing Insight."

TAB 4 — RULES: one Panel Surface block per rule, both and no more:
  - "No form submissions (30d)" — a "Severity it can produce" chip row showing Warning only —
    the condition stated plainly, a numeric threshold control with a live caption showing what
    the current data would produce, an enabled toggle, a last-fired caption, and a note that the
    rule only considers live forms.
  - "Low CTA click rate" — Warning only — the condition, a percentage threshold control with a
    caption naming the current rate against it, an enabled toggle, and a note that the rule
    needs a minimum view count before it can fire so a brand-new CTA does not trip it.

ALSO PRODUCE: the all-clear empty state for Open — line-art level line, "Nothing is flagged in
Marketing Insight", the sentence "Alerts appear here when one of the two rules fires.",
secondary "View rules"; the mute-confirmation modal naming the rule and duration; a loading
skeleton; and a 390px mobile frame.
```

---

## Not duplicated here

Four screens match ones already specified — build once, scope by slug:

- **Customize** (`/admin/insights/marketing-insight/customize`) — same layout editor as
  [School Vitals Screen 6](./stitch-school-vitals-prompts.md), with this section's sixteen KPIs
  in four groups and ten widgets, and no delta-related controls. Two section-specific rules worth
  carrying: the editor should preserve the three pair group headers when widgets are reordered,
  and warn when one half of a labelled pair is hidden and the other is not.
- **Digests** (`/admin/insights/marketing-insight/digests`) — same as School Vitals Screen 7,
  with the range selector omitted. Given sixteen KPIs, the digest contents checklist should offer
  the four KPI groups as collapsible parents rather than sixteen flat checkboxes.
- **Widget library** (`/admin/insights/marketing-insight/library`) — the tenant-wide catalogue
  with this section preselected.
- **Settings** (`/admin/insights/marketing-insight/settings`) — tenant-wide; Marketing Insight is
  one row in its access table.

---

## Backend gaps these prompts assume

| Prompt feature                                                                                 | Status                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Section endpoint returning the sixteen KPIs and ten widgets, exact titles and order            | exists                                                                                                      |
| Attribution split by source, medium, and UTM campaign, each with events and revenue            | exists                                                                                                      |
| Daily leads with both submissions and contacts series                                          | exists                                                                                                      |
| Top forms, top CTAs, top coupons, marketing inventory, recent workflow runs                    | exists                                                                                                      |
| CTA click rate computed as clicks ÷ views, whole-number rounded, zero-safe                     | exists                                                                                                      |
| The two marketing-insight alert rules, both warning-only, with configurable thresholds         | exists                                                                                                      |
| Alert mute (1d / 7d / forever), resolve, persisted alert state                                 | exists                                                                                                      |
| Saved layout, widget detail endpoint, library, settings, digests per slug                      | exist                                                                                                       |
| **Range support for this section**                                                             | **missing** — `buildMarketingInsightWidgets` takes no range, which is why the addendum disables the control |
| **Deltas and sparklines on Marketing Insight KPIs**                                            | **missing** — no `deltaPct`, `deltaAbs`, or `sparkline` on any widget in this builder                       |
| Per-form last-submission timestamp and 30-day submission count (Screen 4)                      | needs backend — the top-forms payload carries title, status, and total submissions only                     |
| Per-CTA click rate on the section widget                                                       | derivable from views and clicks client-side; not returned                                                   |
| Click rate aggregated by CTA type (Screen 4)                                                   | needs backend                                                                                               |
| Source × medium cross-tabulation (Screen 3)                                                    | needs backend                                                                                               |
| Workflow run volume per day, per-workflow run and failure counts, success rate, error messages | needs backend — the recent-runs payload carries workflow title, status, trigger, and created only           |
| "Published but never run" workflow list                                                        | needs backend                                                                                               |
| Revenue-per-event and unstable-rate flagging on attribution                                    | derivable, not returned                                                                                     |

Two correctness notes carried into the addendum. `ctaClickRate` returns `0` when views are zero —
the design shows an em dash with an explanation instead, since a literal "0%" reads as a
catastrophic CTA rather than an unviewed one. And the capture chain's final step (contacts) can
legitimately exceed the step before it (submissions), because contacts are created by paths other
than these forms; the mandatory caption exists so that never reads as a data bug.
