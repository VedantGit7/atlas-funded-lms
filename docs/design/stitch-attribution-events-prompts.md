# Google Stitch Prompts — Attribution Events (`/admin/reports/sales-marketing/attribution`)

Paste **Block 0 (Design System)** first, then **Block 0-AT (Attribution Events addendum)**, then
one screen prompt per generation.

Block 0 is the **admin** design system, identical to the one in the other report-module files.
Reproduced below so this file stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminAttributionEventsPage.tsx`
- `frontend/apps/web/src/features/admin/reports/SalesMarketingReportTabs.tsx`
- `backend/packages/domain/src/sales-marketing/sales-marketing.dto.ts`
- `backend/apps/api/src/app/api/v1/sales/attribution/route.ts`

**The docstring is the design brief.** The page's own comment: "The write side of this data has
been live for a while — the public marketing integrations and the sales beacon both post
attribution events — but `GET /api/v1/sales/attribution` had no caller, so the events accumulated
where nobody could read them. **UTM data nobody can see is indistinguishable from UTM data that
was never captured.**" That last sentence is the whole reason this screen exists, and it also
describes a gap the screen cannot close on its own — see the two-field asymmetry below.

**This is the raw event log, not the rollup.** Marketing Insight and Sales Insight both aggregate
these same events into source, medium, and campaign breakdowns. This tab is the ledger beneath
them — one row per event, nine fields, no joins. The relationship is the same as Payment Orders
to Payment Transactions: come here when the aggregate and the record disagree.

**A note on the endpoint.** Every other tab in this module reads from
`/api/v1/reports/sales-marketing/*`. Attribution reads `/api/v1/sales/attribution` directly —
there is no reports-layer attribution route. That is why this screen has cursor pagination and no
totals while its sibling tabs have page numbers.

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
- Success            #15803D / #62DF7D   — attributed, healthy, complete
- Warning            #B45309 / #E6C364   — unattributed, incomplete, needs attention
- Danger             #DC2626 / #FF8A80   — failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, IDs, UTM values, event types, timestamps: JetBrains Mono.
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
- Every action that writes a record or sends data outside the console opens a confirmation
  that names exactly what happens, in plain words.

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

## Block 0-AT — Attribution Events addendum (paste second)

```text
ATTRIBUTION EVENTS MODULE ADDENDUM — applies to every screen under
/admin/reports/sales-marketing/attribution

WHAT AN ATTRIBUTION EVENT IS
One row recorded when something marketable happened — a tracked visit, a signup, a purchase —
carrying the UTM parameters that were on the URL at the time. It is written by the public
marketing integrations and the sales beacon. This screen is the only place those rows can be
read.
The read record carries exactly nine fields: id, eventType, membershipId, utmSource, utmMedium,
utmCampaign, revenueCents, currency, occurredAt. There is no learner name, no product, no page
URL, no referrer, no device. Never render one.

THIS IS THE LOG, NOT THE ROLLUP
Marketing Insight splits these same events by source, medium, and campaign; Sales Insight credits
revenue from them. Both are aggregates. This tab is the underlying ledger, and it exists for when
an aggregate looks wrong. State it once per screen in a Muted Ink caption: "This is the raw event
log. Source, medium and campaign rollups live in Marketing Insight." Link out rather than
re-aggregating at scale — the small rollup on the sources screen is a scan of the loaded page,
not a replacement for the insight section, and must say so.

TWO CAPTURED FIELDS ARE NOT READABLE — THIS IS THE MOST IMPORTANT FACT HERE
The create body accepts utmTerm, utmContent, and metadataJson. The read DTO returns none of
them. So the platform captures utm_term and utm_content on every tracked visit and then makes
them invisible, which is precisely the failure the module was built to fix, one level down.
Handle it exactly this way:
  - never render a Term or Content column, and never leave a blank one implying the data is
    missing at capture time — it is not missing, it is unreadable;
  - on the event detail screen, carry a Sunken Surface panel titled "Captured but not returned"
    naming utm_term, utm_content, and metadata explicitly, with one plain sentence: "These are
    recorded when an event is created but are not returned by the list endpoint, so this console
    cannot show them.";
  - repeat a one-line version of that in the module's gaps note.
Do not quietly omit them. An operator debugging a campaign will look for utm_term first.

EVENT TYPE IS FREE TEXT, NOT AN ENUM
eventType is a string of up to 64 characters with no constrained values. So:
  - render it in monospace, because it is a machine key an operator will copy;
  - the filter is a text input with a datalist of the types present in the loaded rows as
    suggestions, never a fixed select;
  - never colour-code an event type, and never assume "purchase" or "signup" exists;
  - where a scan groups by type, order by frequency and say the grouping is derived from loaded
    rows.

UTM VALUES ARE SLUGS — RENDER THEM AS SUCH, AND NAME THEIR ABSENCE PRECISELY
utmSource, utmMedium, and utmCampaign are each independently nullable, up to 128 characters.
Render every present value in monospace with a copy icon on hover. For absence, do not print a
bare em dash everywhere — the three nulls mean different things and the design should say which:
  - all three null: the event carries no attribution at all. Render "No UTM" once, spanning the
    three cells, in Warning, with the row taking a Warning left rail.
  - some present, some null: render the missing ones as "Not set" in Muted Ink so a partial
    capture is visibly different from no capture.
This distinction is the difference between "direct traffic" and "our tracking is broken", and it
is the second most useful thing on the screen.

REVENUE AND CURRENCY ARE NULLABLE INDEPENDENTLY — AND THE MISMATCH MATTERS
revenueCents may be null (most events are not purchases) and currency may be null separately.
Three cases, three treatments:
  - both null: a plain em dash. Normal — a visit event has no revenue.
  - both present: monospace, right-aligned, with the currency code as an 11px Muted Ink suffix.
    An unrecognised code must not blank the cell; fall back to plain formatting with the code
    appended, exactly as the shipped page already does.
  - revenue present, currency null: render the amount in monospace with a Warning caption "No
    currency recorded" beneath it. Never guess a currency, never assume the tenant default, and
    never sum such a row into any total.
Never sum across currencies anywhere. Where a total is shown, stack per-currency subtotals and
list amounts with no currency separately.

PAGINATION IS A CURSOR — NO TOTALS, NO PAGE NUMBERS
The list takes a cursor and a limit (1–100, default 50) and returns a nextCursor with a
hasNextPage flag. There is no total count. So: no "1–50 of 4,182", no page numbers, no
jump-to-end. A single "Load more" button at the end, becoming a busy state in place, absent when
there is no next page. Every derived figure on any screen in this module is captioned as covering
loaded rows only.

THE LOG IS READ-ONLY IN PRACTICE
A POST exists — the beacon and the integrations use it — but nothing in this console should
create an attribution event by hand, and there is no update or delete at all. So: no edit, no
delete, no "add event", no bulk mutation, and no selection bar offering anything but export and
clear.

DATA REALISM
Event types in monospace: "page_view", "signup", "checkout_started", "purchase",
"lead_captured". Sources: "google", "instagram", "direct", "partner-rd", "newsletter". Mediums:
"organic", "cpc", "referral", "email", "social". Campaigns: "aug-intake-2026",
"risk-desk-launch", "reactivation-q3". Revenue like 12,499.00 INR and 349.00 USD on purchase
rows only. Membership IDs as 8-character UUID fragments in monospace. Timestamps spread across
today and the last fortnight, with visit events far outnumbering purchases.
```

---

## Screen 1 — `/admin/reports/sales-marketing/attribution` (the event log)

```text
Screen: Attribution events. Route /admin/reports/sales-marketing/attribution. Desktop 1440px,
admin sidebar with "Reports" expanded and "Sales & Marketing" active.

HEADER
Breadcrumb: Admin / Reports / Sales & Marketing / Attribution. Title "Attribution events",
subtitle "Every tracked event and the campaign it came from." Right side: a secondary "Export
CSV" button and a secondary "Open Marketing Insight" button. No primary button — this is a
reading surface and nothing here writes.

SALES & MARKETING TAB STRIP — the module's own nav, underline style, horizontally scrollable:
Overview · Sales · Coupons · Referral & wallet · Affiliate products · Affiliates · Attribution ·
Exports, with "Attribution" active in Accent Indigo.

SCOPE NOTE — a slim Sunken Surface strip directly beneath the tab strip, one line in Muted Ink:
"This is the raw event log. Source, medium and campaign rollups live in Marketing Insight." Not
dismissible.

SIGNAL BAND — unequal cells, first double width, every figure derived from the loaded page with a
caption saying so:
"Loaded 50 events" at 32px monospace with the caption "more may exist — this log is cursor
paginated" | "Event types 5" with the most frequent named beneath in monospace | "No UTM at all
8" in Warning with the caption "no attribution captured", clickable through to the unattributed
screen | "Revenue events 6" with the per-currency split beneath | "Revenue without currency 1" in
Warning.
A Muted Ink line beneath the band: "Counts reflect the events loaded so far, not the whole log."

FILTER BAR — a Sunken Surface strip:
  - an "Event type" text input with the placeholder "All events" and a datalist of the types
    present in the loaded rows, with a caption noting it is a free-text field and any value is
    accepted;
  - a search input with the placeholder "Source, medium, campaign or membership ID", filtering
    the loaded rows client-side, captioned as searching what is loaded;
  - an "Attribution" select (Any, Fully attributed, Partially attributed, No UTM);
  - a "Revenue" select (Any, Has revenue, No revenue, Revenue without currency);
  - a "Refresh" secondary button.
Applied filters render as removable chips beneath with "Clear all".

TABLE — one event per row, columns matching the real read fields exactly:
[checkbox] | Occurred (absolute date and time in monospace with a relative caption) | Event (the
eventType in monospace) | Source (monospace with copy on hover, or "Not set" in Muted Ink) |
Medium (same treatment) | Campaign (same treatment) | Membership (an 8-character monospace UUID
fragment with a copy icon, or "Anonymous" in Muted Ink) | Revenue (per the addendum's three-case
rule) | a kebab (Open event, Copy event ID, Copy campaign, Open in Marketing Insight).
Rows where all three UTM values are null collapse Source, Medium and Campaign into a single
spanning cell reading "No UTM" in Warning, and the row carries a Warning left rail. Rows click
through to the event detail. Sorting is by occurred descending and is not adjustable, because the
cursor orders the feed — say so in a Muted Ink caption at the table foot.
Show 12 rows: seven page_view and signup events with full UTM, two purchase rows carrying revenue
in two different currencies, two rows with the spanning "No UTM" treatment and a Warning rail,
and one partially attributed row where Source and Medium are set but Campaign reads "Not set".

END OF LIST — a single "Load more" secondary button, full width on mobile and auto-width centred
on desktop, with a busy state that keeps its size. When hasNextPage is false the button is absent
and a Muted Ink line reads "End of the log for these filters." No paginator anywhere.

SELECTION BAR (render visible): "6 events selected" with "Export selection" and "Clear", and
nothing else, because no mutation exists.

ALSO PRODUCE as separate frames:
A. Loading — the header, tabs, scope note, and filter bar live, with eight skeleton rows matching
   the exact column widths.
B. Empty log — a line-art mark of a signpost with no signs, heading "No attribution events yet",
   the sentence "Events are recorded when the marketing integrations or the sales beacon post
   them.", and a secondary "Open Marketing Insight".
C. Empty filter — "No events match these filters" with a "Clear filters" button, the signal band
   and filter bar retained.
D. Error — an inline Danger strip reading "Could not load attribution events." with a Retry
   button, replacing the table.
E. Tracking-broken state — the whole loaded page showing the "No UTM" treatment on ten of twelve
   rows, with the signal band's "No UTM at all" cell reading 42 and a Warning strip above the
   table reading "Most loaded events carry no attribution. Check that UTM parameters are reaching
   the beacon." This is the state the screen exists to make visible.
F. Mobile 390px — the filter bar collapses to an event-type input plus a "Filters" button opening
   a bottom sheet; each event becomes a card with the event type as the headline, the three UTM
   values as a labelled stack, revenue where present, and the occurred timestamp; the "Load more"
   button full width.
```

---

## Screen 2 — `/admin/reports/sales-marketing/attribution/[eventId]`

```text
Screen: Event detail. Route /admin/reports/sales-marketing/attribution/[eventId]. Produce it as a
right-side drawer over the log, and also as a standalone page for deep links. Produce two
variants: a fully attributed purchase event, and an event with no UTM at all.

HEADER
Drawer header: the event type in 18px monospace with a close x, and the occurred timestamp
beneath in Muted Ink. Page variant: breadcrumb Admin / Reports / Sales & Marketing / Attribution
/ purchase, title the event type in monospace, subtitle the absolute occurred timestamp with a
relative caption. Right: secondary "Copy event ID", secondary "Open in Marketing Insight".

SOURCE NOTE — a Sunken Surface strip beneath the header, one line in Muted Ink: "Built from the
event log. There is no single-event endpoint, so this view shows the fields the list returns."
Not dismissible.

ATTRIBUTION PANEL — the primary object, a Panel Surface block titled "Attribution", holding three
label/value rows in a generous vertical rhythm:
  - "Source" with the value in 16px monospace and a copy icon;
  - "Medium" the same;
  - "Campaign" the same.
Each row that is null renders "Not set" in Muted Ink with a small caption naming what that means
for reporting: "This event will not appear under any source in Marketing Insight."
In the no-UTM variant the three rows are replaced by a single Warning-tinted block: the words "No
attribution captured" at 16px, and a sentence beneath — "No UTM parameters were present when this
event was recorded. It counts toward totals but cannot be credited to a campaign."

CAPTURED BUT NOT RETURNED — a Sunken Surface panel directly beneath the attribution panel, and
the reason this screen is worth building: the heading "Captured but not returned", then three
monospace field names as rows — utm_term, utm_content, metadata — each with a Muted Ink dash
where a value would sit, and one plain sentence beneath the group: "These are recorded when an
event is created but are not returned by the list endpoint, so this console cannot show them."
A closing Muted Ink line names the fix: "Adding them to the read DTO would make this panel real."

VALUE PANEL — label/value rows: Revenue rendered per the addendum's three-case rule, with the
stored minor units shown in a monospace caption where present ("1249900 minor units"); Currency,
or "Not recorded" in Warning where revenue exists without one; Membership, showing the full UUID
in monospace with a copy icon and a chevron to the member profile, or "Anonymous" in Muted Ink
with a caption "This event is not linked to a learner."

RAW RECORD PANEL — a Sunken Surface block holding the nine returned fields exactly as they come,
as a monospace key/value list with a copy-all button: id, eventType, membershipId, utmSource,
utmMedium, utmCampaign, revenueCents, currency, occurredAt.

RELATED — on the page variant, a right rail at 32% with chevron rows: "Marketing Insight →
Attribution" carrying a caption naming what it aggregates; "Sales Insight → Attribution" for the
revenue-side view; and "Open the learner's member profile", rendered disabled with a caption where
membershipId is null.

ALSO PRODUCE: loading skeleton; a not-found state where the id is not in the loaded log, showing a
centred panel reading "That event is not in the loaded list" with a sentence explaining that the
log is cursor-paginated and the event may be further back, plus a primary "Back to attribution";
and a 390px mobile frame where the drawer is a full-screen sheet and the related rail stacks
beneath.
```

---

## Screen 3 — `/admin/reports/sales-marketing/attribution/sources`

```text
Screen: Source breakdown. Route /admin/reports/sales-marketing/attribution/sources. A scan of the
loaded events grouped three ways — and a screen that must be scrupulously honest that it is not
the real rollup.

HEADER
Breadcrumb: Admin / Reports / Sales & Marketing / Attribution / Sources. Title "Source
breakdown", subtitle "The loaded events grouped by source, medium and campaign." Right: secondary
"Export CSV", and a primary "Open Marketing Insight" — the primary deliberately points away from
this screen, because the authoritative rollup lives there.

SCAN NOTE — a Warning-tinted strip beneath the header, two lines, and the most important element
on the page: "This groups only the events loaded so far, not the whole log. For tenant-wide
attribution totals, use Marketing Insight." A Muted Ink second line states the scope in numbers:
"Currently scanning 50 of an unknown total." Not dismissible.

SIGNAL BAND — unequal cells, all captioned as loaded-only: "Events scanned 50" at 32px monospace
| "Distinct sources 6" | "Distinct mediums 4" | "Distinct campaigns 9" | "Unattributed 8" in
Warning with the caption "no UTM at all".

DIMENSION TABS — a segmented control: Source · Medium · Campaign. The body swaps entirely; the
scan note and signal band stay fixed. Produce the Source tab as the primary frame and the
Campaign tab as a second frame.

BODY, per dimension:
COMPOSITION — a full-width panel: one horizontal stacked band across the content width split by
the active dimension in descending event count, graded tints of Accent Indigo with the leader in
the full accent, each segment labelled with its value in monospace and its share. A trailing
Warning-tinted segment holds the unattributed events, labelled "No UTM" — present in every
breakdown, because those events belong to no value in any dimension. An inline legend beneath
doubles as a filter for the table.

TABLE — one row per distinct value: Value (monospace with a copy icon, or "No UTM" in Warning for
the unattributed group) | Events (monospace with a 3px share bar) | Share (percentage) | Revenue
events (monospace count) | Revenue (per-currency subtotals stacked, never a single summed figure,
with amounts lacking a currency listed separately beneath in Warning) | First seen | Last seen |
a chevron that returns to the log filtered to that value. Sorted by events descending. Show 8
rows including the unattributed group carrying a Warning left rail.

CROSS-DIMENSION PANEL — beneath, only on the Source tab: a compact matrix with sources down the
left and mediums across the top, cells holding event counts in monospace on a background tinted by
value, with pinned totals on the trailing row and column, and a dedicated "No UTM" row and column
so unattributed events are never silently dropped from the grid. A caption names the strongest
pair and repeats the loaded-only caveat.

ALSO PRODUCE: the thin-data state where only 12 events are loaded — every panel renders but the
scan note's second line reads "Currently scanning 12 of an unknown total" and a Muted Ink caption
beneath the table warns that shares from a small scan are unstable; the empty state where nothing
is loaded; a loading skeleton; and a 390px mobile frame where the cross-dimension matrix is
replaced by a top-pairs list with a caption saying the matrix needs a wider screen.
```

---

## Screen 4 — `/admin/reports/sales-marketing/attribution/unattributed`

```text
Screen: Unattributed and incomplete. Route
/admin/reports/sales-marketing/attribution/unattributed. The data-quality worklist — events that
cannot be credited, and events whose value fields disagree.

HEADER
Breadcrumb: Admin / Reports / Sales & Marketing / Attribution / Unattributed. Title "Unattributed
and incomplete", subtitle "Events that cannot be credited to a campaign, and events with a value
problem." Right: secondary "Export CSV", secondary "Back to the log".

DERIVATION NOTE — a Sunken Surface strip beneath the header, one line in Muted Ink: "These groups
are derived from the events loaded so far. Load more on the log to widen the scan." Not
dismissible, because every count here is a client-side scan.

SIGNAL BAND — unequal cells: "Needs attention 12" at 32px monospace in Warning with the caption
"across 50 loaded events" | "No UTM at all 8" in Warning | "Partially attributed 3" in Warning |
"Revenue without currency 1" in Warning | "Share of loaded events 24%" with a 3px bar.

GROUPED WORKLIST — the primary object, one Panel Surface block per fault group, each with a
hairline header carrying the group name, its count, and a sentence explaining why it matters:
1. "No UTM at all" — "These events carry no source, medium or campaign. They count toward totals
   but cannot be credited to anything. A sudden rise usually means UTM parameters are being
   stripped before the beacon sees them."
2. "Partially attributed" — "A source or medium is present but the campaign is missing, or the
   reverse. These appear under one dimension in Marketing Insight and vanish from another, which
   is why a source total and a campaign total can disagree."
3. "Revenue without a currency" — "An amount was recorded with no currency code. It cannot be
   safely added to any total, so it is excluded from every revenue figure in this console."
Inside each block, rows in the log's own column shape trimmed to what matters: Occurred | Event
(monospace) | Source | Medium | Campaign — with the addendum's null treatments applied — |
Revenue | Membership | a kebab (Open event, Copy event ID, Open in Marketing Insight). Rows carry
a Warning left rail throughout.
Show four rows in the first group, three in the second, one in the third.

WHAT THIS USUALLY MEANS — beneath the groups, a Sunken Surface block titled "Common causes",
holding four plain rows, because this console cannot fix any of them: a link shared without UTM
parameters; a redirect or link shortener stripping the query string; the beacon firing before the
parameters are parsed; and a purchase recorded by a server-side integration that never saw the
original URL. Each row is one sentence with no action button, and a closing Muted Ink line states
that attribution events cannot be edited or backfilled from this console.

ALSO PRODUCE: the all-clear state — every group replaced by a single Success-marked line ("Every
loaded event carries attribution", "No partial attribution", "No revenue without a currency") with
the signal band showing zeros and a Success caption reading "Nothing needs attention in the loaded
events"; a loading skeleton; and a 390px mobile frame where each fault row becomes a card and the
common-causes rows stack.
```

---

## Backend gaps these prompts assume

| Prompt feature                                                                                                               | Status                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List attribution events with `eventType`, `cursor`, `limit` (1–100, default 50), returning `nextCursor` and `hasNextPage`    | exists                                                                                                                                                                    |
| Create an attribution event (used by the marketing integrations and the sales beacon)                                        | exists                                                                                                                                                                    |
| The nine returned fields: id, eventType, membershipId, utmSource, utmMedium, utmCampaign, revenueCents, currency, occurredAt | exist                                                                                                                                                                     |
| **`utmTerm`, `utmContent`, and `metadataJson` on read**                                                                      | **missing** — all three are accepted on create and none is returned, which is why Screen 2 carries a dedicated "Captured but not returned" panel instead of blank columns |
| **Read one event by id**                                                                                                     | **missing** — Screen 2 is built from the loaded list and says so                                                                                                          |
| Update or delete an event                                                                                                    | missing, and deliberately not designed — the log is append-only                                                                                                           |
| Server-side totals or counts                                                                                                 | missing — cursor pagination returns no total, which is why every figure on Screens 1, 3 and 4 is captioned as loaded-only                                                 |
| Server-side filtering on source, medium, campaign, or membership                                                             | missing — only `eventType` is a server filter; everything else on Screen 1 is client-side over loaded rows                                                                |
| A date-range filter                                                                                                          | missing — notable, because an attribution log is almost always read by period                                                                                             |
| Server-side grouping by source, medium, or campaign                                                                          | missing at this endpoint — the real rollups live in Marketing Insight, which is why Screen 3's primary button points there                                                |
| A reports-layer attribution route under `/api/v1/reports/sales-marketing/*`                                                  | missing — this tab reads `/api/v1/sales/attribution` directly, unlike every sibling tab                                                                                   |
| CSV export of events                                                                                                         | missing                                                                                                                                                                   |

**The two highest-value backend changes**, in order. First, **return `utmTerm`, `utmContent`, and
`metadataJson`** — the module's own docstring says "UTM data nobody can see is indistinguishable
from UTM data that was never captured", and that is currently still true of two UTM fields.
Second, **a date-range filter and server-side grouping** — without them, every derived figure in
this module is honestly but frustratingly scoped to one cursor page, and an operator investigating
last month's campaign has to load forward through the whole log to reach it.
