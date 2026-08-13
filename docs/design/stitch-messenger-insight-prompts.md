# Google Stitch Prompts — Messenger Insight (`/admin/insights/messenger-insight`)

Paste **Block 0 (Design System)**, then **Block 0-ID (Insights module addendum)**, then
**Block 0-MG (Messenger Insight addendum)**, then one screen prompt per generation.

Block 0 and Block 0-ID are unchanged from
[stitch-insights-dashboard-prompts.md](./stitch-insights-dashboard-prompts.md) — if you are
already in that Stitch project, skip straight to Block 0-MG.

Source of truth:

- `backend/apps/api/src/server/insights/insights.service.ts`
  (`buildMessengerInsightWidgets`, `messengerInsightAlertMetrics`, `whatsappDeliveryRate`)
- `backend/apps/api/src/server/insights/insights-alerts.ts` (the two messenger-insight rules)
- `backend/apps/api/src/server/insights/insights.schemas.ts` (widget, layout, alert contracts)

**Four things to know before designing.** First, like Sales Insight, Live Dashboard, and
Marketing Insight, `buildMessengerInsightWidgets` takes only the snapshot — no `range`, no
deltas, no sparklines. Second, **both alert rules concern WhatsApp and nothing else** — email,
push, announcements, and the inbox have no alerting at all, which is a real asymmetry the design
must not disguise. Third, `whatsapp-disconnected` has a threshold kind of `none`, making it the
only rule in the whole module with nothing to configure. Fourth, the daily-volume widget carries
**four series and mixes directions** — three outbound reach measures plus one inbound inbox
count — which is the single most misreadable thing in this section.

This is the last of the six insight sections. Alongside it: [Dashboard](./stitch-insights-dashboard-prompts.md),
[School Vitals](./stitch-school-vitals-prompts.md), [Sales Insight](./stitch-sales-insight-prompts.md),
[Live Dashboard](./stitch-live-dashboard-prompts.md), [Marketing Insight](./stitch-marketing-insight-prompts.md).

---

## Block 0-MG — Messenger Insight addendum (paste third)

```text
MESSENGER INSIGHT SECTION ADDENDUM — applies to every screen under
/admin/insights/messenger-insight

WHAT THIS SECTION ANSWERS
What the academy is sending, to how many people, on which channel, and whether it arrived. Plus
what is coming back in — the inbox. It is the communications pulse. Marketing Insight owns the
capture surfaces that generate leads; this section owns the messages that go out to them and the
conversations that come back.

THIS SECTION DOES NOT RESPOND TO THE RANGE CONTROL
Windows are fixed in widget titles — "(30d)" — and the section is built from a snapshot with no
range parameter. Keep the range control visible for consistency but render it disabled with the
Muted Ink caption "Messenger Insight uses fixed windows shown in each widget title". Never hide
it, never let it look active. Repeat the caption once beneath the KPI region.

NO DELTAS IN THIS SECTION
No widget carries deltaPct, deltaAbs, or a sparkline. KPI cards render label and value only.
Where a comparison exists it is an adjacent KPI pair — all-time beside 30-day — and those pairs
must sit next to each other.

OUTBOUND AND INBOUND ARE DIFFERENT DIRECTIONS — NEVER BLEND THEM
Email, push, WhatsApp, and announcements are outbound: the academy sends them. Inbox messages
and open conversations are inbound: learners send them. These are opposite flows and must never
be summed, stacked, or ranked against each other. Wherever both appear:
  - give inbound its own visual treatment — a distinct line style or a separated group — and
    label the two directions explicitly;
  - never include inbox counts in any "total reach" or "channel mix" figure;
  - state the split once per screen in a Muted Ink caption: "Email, push, WhatsApp, and
    announcements are outbound. Inbox messages are inbound."

"DAILY MESSAGING VOLUME (30D)" IS THE RISKIEST WIDGET IN THE MODULE
It carries four series — email reach, push reach, WhatsApp reach, inbox messages — and the first
three are outbound reach while the fourth is inbound message count. Draw it as follows and no
other way:
  - the three outbound reach series as solid lines in graded tints of Accent Indigo;
  - inbox messages as a dashed Muted Ink line on a SECOND Y-AXIS, right-hand side, labelled
    "Inbox messages (inbound)";
  - an inline legend above the plot that groups the three outbound series under a small
    "Outbound reach" label and the inbox series under "Inbound";
  - a mandatory caption beneath: "Outbound reach counts recipients; inbox counts messages
    received. The two are plotted on separate axes and cannot be added."
Never stack these four. Never draw them on one axis. Never total them.

THE SIXTEEN KPIs — exactly these, in exactly this order, all span third
Outbound campaigns sent · Total outbound reach · Email campaigns sent · Email recipients ·
Email recipients (30d) · Push messages sent · Push recipients · WhatsApp campaigns sent ·
WhatsApp delivered · WhatsApp failed · WhatsApp delivery % · Announcements sent ·
Inbox messages · Inbox messages (30d) · Open conversations · Scheduled campaigns.
Group them under four hairline sub-headers, four cards each:
  "Outbound totals" — Outbound campaigns sent, Total outbound reach, Email campaigns sent,
  Email recipients
  "Email and push" — Email recipients (30d), Push messages sent, Push recipients, WhatsApp
  campaigns sent
  "WhatsApp delivery" — WhatsApp delivered, WhatsApp failed, WhatsApp delivery %, Announcements
  sent
  "Inbound and scheduled" — Inbox messages, Inbox messages (30d), Open conversations, Scheduled
  campaigns
"WhatsApp failed" is inverted — higher is worse — and carries a Warning tint and a caption
saying so. "WhatsApp delivery %" is a whole-number percentage with a trailing % and a 3px bar;
where recipients are zero it shows an em dash with the caption "No WhatsApp sends recorded",
never 0%. "Scheduled campaigns" is a computed sum of email, push, and WhatsApp scheduled counts
— it has no single source, so it carries a Muted Ink caption "Email, push, and WhatsApp
combined" and is never clickable through to a single list.

FOUR CONSECUTIVE HALF-SPAN "RECENT" TABLES — GROUP THEM AS ONE SEND LOG
Widgets 4 through 7 are all half-span tables of recent sends, one per channel, and would
otherwise read as a featureless 2×2 grid. Place a single hairline group header above all four
reading "Recent sends by channel", and give the four tables identical row heights and aligned
Recipients and Sent columns so the eye can scan down the grid. Each keeps its own widget title
inside its frame. WhatsApp is the only one of the four carrying Delivered and Failed columns —
that asymmetry is real and must not be evened out with empty columns on the others.

CHANNEL VALUES COME FROM THE DATA
"Sends by channel" and "Reach by channel" render whatever channels the payload contains, in its
own order, and the two must use identical category order and identical bar colours so they read
as a matched pair. Add a shared caption beneath the pair naming any mismatch — "Push is 38% of
sends but 61% of reach." Never merge them into one stacked chart: sends and recipients are
different units.

STATUS AND TYPE VALUES COME FROM THE DATA
Campaign status, push status, WhatsApp status, and announcement type all render whatever the
payload contains. Tint only what is unambiguous — "sent" or "delivered" in Success, "failed" in
Danger, "scheduled" in Warning, "draft" in Muted — and leave the rest neutral. The push table's
"Channels" column is a free-text list of the delivery channels that push used; render it as
small chips rather than a sentence.

THE TWO ALERT RULES — BOTH ARE ABOUT WHATSAPP, AND THAT IS WORTH SAYING
whatsapp-failures (fires on any failure; info below the threshold, warning at or above it) ·
whatsapp-disconnected (info, and it has NO configurable threshold).
Email, push, announcements, and the inbox have no alerting whatsoever. Do not invent rules for
them, and on the alerts screen state the coverage gap plainly in a caption rather than letting
the reader assume silence means health. This section cannot produce a critical.

DATA REALISM FOR THIS SECTION
Campaign names like "August intake — week 1", "Risk desk reminder", "Foundations welcome".
Announcement types like "Course update", "Maintenance", "Policy". Channels like "email", "push",
"whatsapp", "in-app". Counts like 218 campaigns sent, 84,120 total reach, 12,480 email
recipients, 3,412 WhatsApp delivered, 84 failed. Rates like 97%. Inbox counts like 1,284
messages and 42 open conversations.
```

---

## Screen 1 — `/admin/insights/messenger-insight` (the section)

```text
Screen: Insights — Messenger Insight. Route /admin/insights/messenger-insight. Desktop 1440px,
admin sidebar with "Insights" expanded and "Messenger Insight" active.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight. Title "Messenger Insight", subtitle "What the
academy is sending, whether it arrived, and what is coming back." Right side: the range
segmented control rendered DISABLED with the Muted Ink caption "Messenger Insight uses fixed
windows shown in each widget title" beside it, a secondary "Customize" button, a secondary
"Export" button, and a primary "Refresh" with a "Generated 4 minutes ago" caption beneath it.

MODULE TAB STRIP: Dashboard · School Vitals · Sales Insight · Live Dashboard · Marketing
Insight · Messenger Insight, with "Messenger Insight" active.

ALERT STACK — beneath the tab strip. Both of this section's rules concern WhatsApp, and neither
can produce a critical. Render two strips:
  - Warning: "WhatsApp delivery failures — 84 WhatsApp sends failed, at or above your threshold
    of 50." with a chevron link.
  - Info: "WhatsApp not connected — the WhatsApp integration is not currently connected."
    with a chevron link.
No Danger strip anywhere on this screen.

KPI REGION — sixteen cards in a four-column grid under four hairline sub-headers, four per row,
label and value only, no deltas or sparklines:
"Outbound totals" — Outbound campaigns sent (218), Total outbound reach (84,120), Email campaigns
sent (142), Email recipients (61,480).
"Email and push" — Email recipients (30d) (12,480), Push messages sent (48), Push recipients
(18,240), WhatsApp campaigns sent (28).
"WhatsApp delivery" — WhatsApp delivered (3,412), WhatsApp failed (84, Warning-tinted with the
caption "Higher is worse"), WhatsApp delivery % (97% with a 3px bar), Announcements sent (36).
"Inbound and scheduled" — Inbox messages (1,284), Inbox messages (30d) (218), Open conversations
(42), Scheduled campaigns (9, with the caption "Email, push, and WhatsApp combined").
Beneath the region, two Muted Ink captions: the fixed-window note, and the outbound/inbound split
note from the addendum.

WIDGET GRID — two-column, in the exact order below:
1. "Sends by channel" — half — horizontal bars, one per channel from the payload, counts in
   monospace, largest in full Accent Indigo and the rest at 60% tint.
2. "Reach by channel" — half — the identical bar treatment over the same channel categories in
   the same order and colours, counting recipients instead of sends, positioned beside widget 1
   as a matched pair, with a shared caption beneath the two: "Push is 38% of sends but 61% of
   reach."
3. "Daily messaging volume (30d)" — full — the four-series chart drawn exactly as the addendum
   specifies: three solid outbound reach lines in graded Accent Indigo tints on the left axis,
   inbox messages as a dashed Muted Ink line on a right-hand second axis labelled "Inbox
   messages (inbound)", a grouped inline legend with "Outbound reach" and "Inbound" sub-labels,
   and the mandatory caption beneath.
Group header "Recent sends by channel" spanning both columns:
4. "Recent marketing emails" — half — a table: Campaign (title in Accent Indigo) | Status pill |
   Recipients (monospace) | Sent (date and time in monospace). Five rows.
5. "Recent push messages" — half — a table: Push (title in Accent Indigo) | Status pill |
   Channels (small chips) | Recipients (monospace) | Sent. Five rows, aligned row-for-row with
   the table beside it.
6. "Recent WhatsApp campaigns" — half — a table: Campaign (title in Accent Indigo) | Status pill
   | Recipients (monospace) | Delivered (monospace) | Failed (monospace, Warning-tinted where
   non-zero) | Sent. Five rows including one with failures carrying a Warning left rail. A
   caption above notes this is the only channel reporting per-send delivery outcomes.
7. "Recent announcements" — half — a table: Announcement (title in Accent Indigo) | Type chip |
   Recipients (monospace) | Sent. Five rows.

ALSO PRODUCE as separate frames:
A. Loading — two shimmer alert strips, sixteen KPI shimmer cards keeping all four group headers,
   each widget frame skeletoned to its default visualization with the group header intact.
B. Empty — a tenant that has sent nothing: every KPI zero, WhatsApp delivery % showing an em
   dash with "No WhatsApp sends recorded", and all seven widgets in their own empty states with
   channel-specific sentences ("No marketing emails sent yet", "No WhatsApp campaigns sent yet").
C. WhatsApp disconnected — the same populated screen but with the WhatsApp KPIs rendered at
   reduced emphasis carrying a Muted Ink caption "Integration not connected — figures are
   historical", and the "Recent WhatsApp campaigns" widget showing the same treatment. Nothing
   is hidden; the data is simply labelled as no longer updating.
D. Error — an inline Danger strip replacing the widget grid, KPIs retained.
E. Mobile 390px — module tabs scroll horizontally, KPIs two-up with all four group headers
   intact, the "Recent sends by channel" group header retained above the four stacked tables,
   the four-series chart dropping to the three outbound series with a caption saying the inbound
   axis needs a wider screen.
```

---

## Screen 2 — `/admin/insights/messenger-insight/widgets/[widgetId]`

```text
Screen: Widget detail. Route /admin/insights/messenger-insight/widgets/[widgetId]. The expanded
view of one widget, backed by the widget detail endpoint. Produce a full page and a full-screen
overlay variant over the section.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight / Daily messaging volume (30d). Title: the
widget title. Beneath it the server-supplied description as a Muted Ink sentence, and the widget
id in 10px monospace with a copy icon. Right: a full labelled visualization segmented control
showing only compatible types with the server default marked; a secondary "Copy as CSV"; a
secondary "Export"; and a primary "Open the full report" driven by the endpoint's related links.
No range control — the window is fixed and stated in the title.

HEADLINE STRIP — from the endpoint's comparison block: current value at 32px monospace with its
currentLabel beneath, previous value with its previousLabel, absolute delta, percentage delta
tinted Success or Warning by direction — with the tint inverted and captioned for "WhatsApp
failed". Then the endpoint's average as its own cell. A null comparison shows the current value
alone with "No comparable previous period". For the WhatsApp widget, the endpoint's failure-rate
block renders as an extra cell: current percentage, previous percentage, delta, and its note as
a Muted Ink caption.

CHART PANEL — the widget at full width and about 420px tall with axis labels, a legend row that
toggles series, and hover tooltips. For "Daily messaging volume (30d)" the dual-axis treatment
and the grouped legend are retained at this size, each series individually toggleable, and the
mandatory caption carried through — plus a "Show outbound only" toggle that hides the inbound
series and its axis entirely, which is the honest way to make the chart simpler rather than
blending the units. Beneath the chart, the endpoint's insightNote in a Sunken Surface strip.

SPLITS — a "Split by" segmented control from the endpoint's splitOptions, redrawing the chart
with an inline legend, plus a split table: Label | Value (monospace) | Share (percentage with a
3px bar), sorted descending. Where splitOptions is empty, one Muted Ink line replaces the region.

UNDERLYING DATA — a Sunken Surface panel behind a "Show underlying data" toggle, expanding to
the exact normalized payload with each column's kind as a 10px monospace marker in the header,
every row, right-aligned measures, and a footer with the row count and a "Copy as CSV" button.
For the four-series widget this table is especially important, because it is where an operator
can confirm the two units are separate columns.

RELATED — a right rail at 32% with the endpoint's related array as rows: title, one-line
description, chevron, and the icon type as a small Muted Ink marker.

ALSO PRODUCE: the bar-widget variant for the two channel widgets, where the chart is a full-width
bar chart with a "Compare with the paired widget" toggle overlaying the other measure on a
secondary axis and a caption explaining that sends and recipients are different units; the
table-widget variant where the chart panel becomes the full sortable, searchable, paginated
table and the underlying-data panel is dropped; a loading skeleton; an empty variant; and a 390px
mobile frame where the related rail stacks beneath.
```

---

## Screen 3 — `/admin/insights/messenger-insight/channels`

```text
Screen: Channels. Route /admin/insights/messenger-insight/channels. The channel-mix pair and the
volume chart given a full screen, because comparing channels on two different units is the job.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight / Channels. Title "Channels", subtitle "What
each channel sends, who it reaches, and how that has moved." Right: secondary "Copy as CSV",
secondary "Export", primary "Manage campaigns".

DIRECTION CAVEAT — a Sunken Surface strip beneath the header, one line in Muted Ink: "Email,
push, WhatsApp, and announcements are outbound and appear in every figure on this screen. Inbox
messages are inbound and appear only where explicitly labelled." Not dismissible.

HEADLINE BAND (unequal cells, first double width): "Outbound reach 84,120" at 32px monospace
with the caption "across 218 campaigns" | "Campaigns sent 218" | "Average reach per campaign
386" | "Channels used 4" | "Scheduled 9" with the caption "email, push, and WhatsApp combined".

THE TWO-UNIT COMPARISON — a full-width panel, the primary object: one row per channel, and
inside each row two horizontal bars stacked tightly — an upper bar for sends and a lower bar for
recipients, each scaled against its own maximum and labelled with its value in monospace at the
right. Because the two bars use different scales, each row carries a small Muted Ink note giving
that channel's recipients-per-send ratio, and a caption beneath the panel names the channel with
the highest and lowest ratio. This is the honest alternative to plotting two units on one axis.

VOLUME OVER TIME — beneath: the four-series chart from the section, at full height, with the
dual-axis treatment, grouped legend, per-series toggles, the mandatory caption, and a "Show
outbound only" toggle. A dashed line marks the 30-day mean total outbound reach.

CHANNEL TABLE — beneath: Channel (name in Accent Indigo) | Direction chip (Outbound / Inbound) |
Sends (monospace with a 3px share bar) | Recipients (monospace with its own share bar) |
Recipients per send (monospace) | Share of outbound reach (percentage) | Last send (relative +
absolute) | a chevron to that channel's campaign list. Outbound channels first, then a hairline
divider, then inbound rows whose Sends and Recipients cells show em dashes with the caption "Not
applicable to inbound" rather than zeros.

ALSO PRODUCE: the single-channel state where only email has been used — the comparison panel
shows one row and a caption suggests other channels exist but are unused, rather than rendering
three empty rows; a loading skeleton; and a 390px mobile frame where each channel becomes a card
with its two bars stacked and the volume chart drops to outbound only.
```

---

## Screen 4 — `/admin/insights/messenger-insight/whatsapp`

```text
Screen: WhatsApp. Route /admin/insights/messenger-insight/whatsapp. The only channel with
delivery reporting and the only one with alerting — so it earns its own screen.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight / WhatsApp. Title "WhatsApp", subtitle "The
only channel that reports per-send delivery outcomes." Right: secondary "Copy as CSV", secondary
"Export", primary "WhatsApp settings" linking to the integration configuration.

CONNECTION BANNER — directly beneath the header, before any figure. Produce this screen twice,
once per state:
  - Connected: a slim Sunken Surface strip, one line — "WhatsApp connected · last send 2 hours
    ago" — quiet, never Success-green.
  - Not connected: a Warning-tinted strip two lines tall — "WhatsApp is not connected. The
    figures below are historical and will not update." with a primary "Reconnect WhatsApp"
    button. Everything below stays fully visible and readable, labelled rather than hidden.

HEADLINE BAND (unequal cells, first double width): "Delivery rate 97%" at 32px monospace with a
3px bar and the caption "3,412 delivered of 3,496 recipients" | "Campaigns sent 28" | "Delivered
3,412" in Success | "Failed 84" in Danger with the caption "2.4% of recipients", clickable to
filter | "Scheduled 3".

DELIVERY COMPOSITION — a full-width panel: one horizontal stacked bar across the content width
split into Delivered (Success) and Failed (Danger), each labelled with its count and share, and
a trailing Outline segment for recipients with no outcome recorded where the payload implies
one. A caption beneath states the arithmetic plainly: "3,412 delivered + 84 failed = 3,496
recipients."

CAMPAIGN TABLE — the detail: [checkbox] | Campaign (title in Accent Indigo) | Status pill |
Recipients (monospace) | Delivered (monospace with a 3px bar) | Failed (monospace, Warning-tinted
where non-zero) | Delivery rate (percentage with a 3px bar; Warning tint below the tenant
average; an em dash with "No recipients recorded" where recipients are zero) | Sent (date and
time in monospace) | a kebab (Open campaign, View recipients, Copy campaign id). Rows with a
delivery rate below the tenant average carry a Warning left rail. Sorted by sent descending.
Show 10 rows including two with meaningful failure counts and one fully failed campaign carrying
a Danger rail.

FAILURE PANEL — beneath, asymmetric 58/42:
LEFT: "Failures over time" — bars per day over the last 30 days showing failed sends in Warning
against delivered sends in Accent Indigo, stacked, with an inline legend and a caption naming
any day with an unusual failure share. Days with no sends render as a hollow tick.
RIGHT: "What to check" — a plain list of the common causes of WhatsApp delivery failure as rows
with a one-line description each — recipient has not opted in, number not registered on
WhatsApp, template not approved, rate limit reached, integration token expired — each with a
chevron to the relevant setting or documentation. A Muted Ink caption states that the platform
records the failure count but not always the reason, so this list is guidance rather than a
diagnosis.

ALSO PRODUCE: the never-used state — every panel replaced by a centred block with a line-art
mark, "No WhatsApp campaigns sent", two sentences on what the channel does, and a primary
"WhatsApp settings"; the perfect-delivery state where failures are zero, the composition bar is
entirely Success, the failure panel collapses to a single Success line reading "No delivery
failures recorded in this window", and the "What to check" list is hidden entirely; a loading
skeleton; and a 390px mobile frame.
```

---

## Screen 5 — `/admin/insights/messenger-insight/inbox`

```text
Screen: Inbox. Route /admin/insights/messenger-insight/inbox. The inbound side — what learners
are sending in, and what is still open.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight / Inbox. Title "Inbox", subtitle "What learners
are sending in, and what is still waiting." Right: secondary "Copy as CSV", secondary "Export",
primary "Open the inbox" linking to the messaging console.

DIRECTION NOTE — a Sunken Surface strip beneath the header, one line in Muted Ink: "Everything
on this screen is inbound. It is never included in outbound reach or channel-mix figures." Not
dismissible — it is the counterpart to the outbound caveat elsewhere in the section.

HEADLINE BAND (unequal cells, first double width): "Inbox messages 1,284" at 32px monospace with
the caption "218 in the last 30 days" | "Open conversations 42" in Warning | "Messages (30d)
218" | "Average per day 7.3" | "Busiest day 12 Aug · 24 messages".

VOLUME — a full-width panel: bars per day over the last 30 days of inbound message counts,
Accent Indigo, with a dashed line at the 30-day mean and a subtle Sunken Surface backdrop on
weekend columns. A caption names the busiest and quietest days and any weekday pattern. Days
with no messages render as hollow ticks rather than zero bars.

BENEATH — asymmetric 58/42:
LEFT: "Open conversations" — a table: Conversation (the learner's display name in Accent Indigo
with the last message truncated to one line beneath in Muted Ink) | Messages (monospace) | Last
message (relative + absolute; Warning tint past 48 hours) | Waiting on (a chip: Us / Learner) |
a chevron to the conversation. Ten rows, sorted by oldest-waiting first so the most neglected
lead, with rows waiting on us past 48 hours carrying a Warning rail.
RIGHT: two stacked panels —
1. "Response time" — two figures in monospace, median and longest time to first reply, each with
   a plain caption, plus a small distribution of reply times in four buckets as labelled bars.
2. "No alerting here" — a deliberately plain Sunken Surface panel with one Muted Ink sentence:
   "Messenger Insight has no alert rules for the inbox. Open conversations will not raise an
   alert however long they wait." and a chevron to the alerts screen. This panel exists because
   silence should never be mistaken for health.

ALSO PRODUCE: the empty state — "No inbound messages in this window" with a line-art mark and
the direction note retained; the all-clear state where open conversations are zero, the table
replaced by a Success line reading "No open conversations", and the response-time panel still
shown for historical context; a loading skeleton; and a 390px mobile frame where the right rail
stacks beneath and conversations become cards.
```

---

## Screen 6 — `/admin/insights/messenger-insight/alerts`

```text
Screen: Alerts. Route /admin/insights/messenger-insight/alerts. Scoped to this section's two
rules — both of which concern WhatsApp only.

HEADER
Breadcrumb: Admin / Insights / Messenger Insight / Alerts. Title "Alerts", subtitle "What
Messenger Insight is flagging, and what it does not watch." Right: secondary "Export CSV",
secondary "View all insight alerts", primary "Mark all as seen".

COVERAGE STRIP — directly beneath the header, before the summary band: a Sunken Surface strip in
Muted Ink, two lines: "Both rules in this section watch WhatsApp. Email, push, announcements,
and the inbox have no alert rules — no alert will fire for them however they perform." This is
the most important sentence on the screen and must never be removed or collapsed.

SUMMARY BAND (unequal cells, first double width): "Open alerts 2" at 32px monospace with the
caption "1 warning · 1 info" and a two-segment composition bar | "New since yesterday 1" |
"Resolved this week 2" in Success | "Muted 0" | "Rules 2" with the caption "both WhatsApp".
No critical cell — this section cannot produce one.

VIEW TABS: Open · Resolved · Muted · Rules.

TAB 1 — OPEN: full-width strips matching the section's own alert rendering exactly, grouped under
hairline severity headers with counts, warning first. Each strip: severity-tinted background,
title at 15px/600, message beneath, and on the right a first-seen timestamp in monospace, a
chevron where an href exists, and a kebab (Open the linked page, Mute for 1 day, Mute for 7 days,
Mute forever, Mark as resolved, Copy alert id). Show the two alerts from Screen 1.

TAB 2 — RESOLVED: a dense table: Alert (title with message truncated beneath) | Severity pill |
Rule id in 10px monospace | First seen | Resolved (relative + absolute) | Resolved by (a name, or
"Automatically" in Muted Ink where the condition cleared — including the reconnection case) |
Duration open (monospace) | kebab. Five rows, including one whatsapp-failures row that shows an
info-to-warning escalation with an arrow between the two severities and a caption "escalated as
failures passed the threshold".

TAB 3 — MUTED: the same table plus "Muted until" in Warning with "Forever" as a plain word, an
"Unmute" text button per row, and a caption explaining that muting hides the alert but does not
change the condition. A Warning strip sits at the top of this tab: "Muting WhatsApp failures
hides the only delivery signal this section watches."

TAB 4 — RULES: one Panel Surface block per rule, both and no more — and the two blocks are
deliberately different shapes because one has a threshold and the other does not:
  - "WhatsApp delivery failures" — a "Severity it can produce" chip row showing Info and Warning
    — the condition stated plainly ("Notify on any failed send; raise it to a warning at N or
    more"), a numeric threshold control with a live caption showing what the current data would
    produce, an enabled toggle, and a last-fired caption.
  - "WhatsApp not connected" — a chip row showing Info only, the condition in one sentence, an
    enabled toggle, a last-fired caption, and — in place of a threshold control — a Muted Ink
    line reading "This rule has no threshold. It fires whenever the integration is disconnected."
    The block must visibly lack a threshold field rather than showing a disabled one.
Beneath both blocks, a dashed-border panel repeating the coverage gap: "No rules watch email,
push, announcements, or the inbox." with no action button, because none exists yet.

ALSO PRODUCE: the all-clear empty state for Open — line-art level line, "Nothing is flagged in
Messenger Insight", the sentence "Both rules watch WhatsApp, and neither is firing.", with the
coverage strip still present above it; the mute-confirmation modal naming the rule and duration;
a loading skeleton; and a 390px mobile frame.
```

---

## Not duplicated here

Four screens match ones already specified — build once, scope by slug:

- **Customize** (`/admin/insights/messenger-insight/customize`) — same layout editor as
  [School Vitals Screen 6](./stitch-school-vitals-prompts.md), with this section's sixteen KPIs in
  four groups and seven widgets, and no delta-related controls. Two section-specific rules: the
  editor should preserve the "Recent sends by channel" group header on reorder, and warn when one
  half of the sends/reach pair is hidden and the other is not.
- **Digests** (`/admin/insights/messenger-insight/digests`) — same as School Vitals Screen 7, with
  the range selector omitted and the KPI checklist offering the four groups as collapsible
  parents. One caption worth adding: a digest containing the four-series volume chart renders it
  as a static image, so the dual axis must be legible without interaction.
- **Widget library** (`/admin/insights/messenger-insight/library`) — the tenant-wide catalogue
  with this section preselected.
- **Settings** (`/admin/insights/messenger-insight/settings`) — tenant-wide; Messenger Insight is
  one row in its access table, and that row should carry the "Contains personal data" marker
  because the inbox screen exposes learner names.

---

## Backend gaps these prompts assume

| Prompt feature                                                                         | Status                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section endpoint returning the sixteen KPIs and seven widgets, exact titles and order  | exists                                                                                                                                                       |
| Channel mix for both sends and reach                                                   | exists                                                                                                                                                       |
| Four-series daily volume (email, push, WhatsApp reach plus inbox messages)             | exists                                                                                                                                                       |
| Recent email, push, WhatsApp, and announcement tables                                  | exists                                                                                                                                                       |
| WhatsApp delivered, failed, and delivery rate, zero-safe                               | exists                                                                                                                                                       |
| WhatsApp connection state (`whatsappConnected`) driving the disconnected rule          | exists                                                                                                                                                       |
| The two messenger-insight alert rules, including the threshold-less disconnected rule  | exists                                                                                                                                                       |
| Alert mute (1d / 7d / forever), resolve, persisted alert state                         | exists                                                                                                                                                       |
| Saved layout, widget detail endpoint, library, settings, digests per slug              | exist                                                                                                                                                        |
| **Range support for this section**                                                     | **missing** — `buildMessengerInsightWidgets` takes no range                                                                                                  |
| **Deltas and sparklines on Messenger Insight KPIs**                                    | **missing** — no `deltaPct`, `deltaAbs`, or `sparkline` in this builder                                                                                      |
| Per-campaign delivery rate on the WhatsApp screen                                      | derivable from delivered ÷ recipients client-side; not returned                                                                                              |
| WhatsApp failures over time (Screen 4)                                                 | needs backend — only totals are returned, not a daily series                                                                                                 |
| Failure reasons per send                                                               | needs backend, and may not be available from the provider at all — the design deliberately frames the "What to check" list as guidance rather than diagnosis |
| Open-conversation detail: learner, last message, waiting-on, response times (Screen 5) | needs backend — only `openConversationCount` and message counts exist today                                                                                  |
| Recipients-per-send ratio and last-send-per-channel (Screen 3)                         | derivable, not returned                                                                                                                                      |
| Alert rules for email, push, announcements, or the inbox                               | **do not exist** — the coverage strip on Screen 6 exists to state that plainly rather than let silence read as health                                        |

Two correctness notes carried into the addendum. `whatsappDeliveryRate` returns `0` when
recipients are zero — the design shows an em dash instead, since a literal "0%" reads as total
delivery failure rather than no sends. And "Scheduled campaigns" is computed in the service as
the sum of three separate scheduled counts, so it has no single underlying list — the caption and
the absence of a drill-through are deliberate, not an oversight.
