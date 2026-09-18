# Google Stitch Prompts — Payment Orders (`/admin/reports/payments/orders`)

Paste **Block 0 (Design System)** first, then **Block 0-PO (Payment Orders addendum)**, then one
screen prompt per generation.

Block 0 is the **admin** design system, identical to the one in the other report-module files.
Reproduced below so this file stands alone. This module is a tab inside the Payments report, so
the [Payments money-rendering addendum](./stitch-payments-prompts.md) still applies — but Orders
is a different object from Transactions and the addendum below says exactly how.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminPaymentOrdersPage.tsx`
- `frontend/apps/web/src/features/admin/reports/PaymentsReportTabs.tsx`
- `backend/packages/domain/src/payments/payments.dto.ts`
- `backend/packages/domain/src/shared/domain.dto.ts` (`PAYMENT_ORDER_STATUSES`)
- `backend/apps/api/src/app/api/v1/payments/orders/route.ts`
- `backend/apps/api/src/app/api/v1/payments/webhooks/{razorpay,stripe}/route.ts`

**The docstring is the design brief.** The page's own comment states it plainly: "a Razorpay or
Stripe webhook updates an order by `externalId`, so when settlement goes wrong the order row is
the only place the mismatch is visible. Manual creation is the reconciliation escape hatch for a
payment taken out of band; it is deliberately behind `config.update` rather than an ordinary
reporting permission." Everything below follows from those two sentences.

**Orders is not Transactions.** The Transactions tab is the enriched commercial view — learner,
product, gateway, coupon, tax, invoice number. Orders is the raw ledger row the gateway settles
against: eight fields and nothing else. Where an admin wants the story, send them to
Transactions; this screen exists for when the story and the ledger disagree.

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
- Success            #15803D / #62DF7D   — paid, settled, healthy
- Warning            #B45309 / #E6C364   — pending, unmatched, needs attention
- Danger             #DC2626 / #FF8A80   — failed, refunded, cancelled, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, IDs, external references, timestamps: JetBrains Mono.
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
- Every action that records, refunds, or voids money must restate the exact amount, currency,
  and target in the confirmation, and show an irreversible-action caption.

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

## Block 0-PO — Payment Orders addendum (paste second)

```text
PAYMENT ORDERS MODULE ADDENDUM — applies to every screen under
/admin/reports/payments/orders

WHAT AN ORDER IS, AND WHAT IT IS NOT
A payment order is the raw ledger row a gateway webhook settles against. It carries exactly eight
fields: id, membershipId, externalId, amountCents, currency, status, paidAt, createdAt. There is
no product, no learner name, no gateway, no coupon, no tax, no invoice number on this record.
The Transactions tab holds all of that. So:
  - never render a product title, a learner name, a gateway chip, or an invoice number on an
    order row — the data is not there;
  - where an admin needs that context, link out with "Open in Transactions" rather than
    half-resolving it;
  - state the split once per screen in a Muted Ink caption: "Orders are the raw ledger rows
    gateways settle against. Learner, product and gateway detail lives in Transactions."
This screen is deliberately sparse. Do not dress it up.

EXTERNAL ID IS THE JOIN KEY — AND ITS ABSENCE IS THE MOST IMPORTANT SIGNAL HERE
Stripe and Razorpay webhooks find an order by `externalId` and update its status. An order with a
null externalId can never be settled by a webhook: it will sit pending forever unless someone
fixes it by hand. That makes a missing externalId a real operational fault, not a cosmetic gap.
So:
  - render externalId in monospace with a copy icon wherever it appears;
  - where it is null, do not print an em dash and move on — print "No external ID" in Warning
    with a caption "Webhooks cannot settle this order";
  - give any pending order with a null externalId a Warning left rail on its row;
  - surface the count of such orders prominently rather than leaving it to be discovered.

THE FIVE STATUSES ARE LOWERCASE AND EXACT
pending · paid · failed · refunded · cancelled.
Render sentence-case as pills: Pending in Warning, Paid in Success, Failed in Danger, Refunded in
Danger, Cancelled in Muted. Never invent "processing", "settled", or "authorised" — those values
cannot occur. Status is a plain string on the DTO but the query and create bodies both constrain
it to this enum, so a value outside the five is a data fault worth rendering in Muted Ink with a
caption rather than silently tinting as neutral.

PAID-AT AND STATUS CAN DISAGREE, AND THAT DISAGREEMENT IS WORTH SEEING
`paidAt` is nullable and set independently by the webhook. Two mismatches matter and must be
called out inline on the row rather than left to arithmetic:
  - status is paid but paidAt is null — the settlement landed without a timestamp;
  - status is not paid but paidAt is set — the order was settled and later moved.
Render either case with a small Warning caption beneath the status pill naming the mismatch in
plain words. Never hide one behind the other.

MONEY IS MINOR UNITS ON THE WIRE AND MAJOR UNITS ON SCREEN
`amountCents` is an integer in minor units; the screen shows major units. Render monospace,
right-aligned, decimals aligned down the column, with the currency code as an 11px Muted Ink
suffix: "12,499.00 INR". Currency is a free three-character string, so an unrecognised code must
never blank the cell — fall back to plain formatting with the code appended, exactly as the
shipped page already does. Never sum across currencies; where a total is shown, stack per-currency
subtotals.

PAGINATION IS A CURSOR — NO TOTALS, NO PAGE NUMBERS
The list takes a cursor and a limit (1–100, default 50) and returns a nextCursor. There is no
total count. So: no "1–50 of 812", no page numbers, no jump-to-last. A single "Load more" button
at the end of the list, becoming a busy state in place, disappearing when there is no next
cursor. Never invent a count for the header.

CREATION IS A RECONCILIATION ESCAPE HATCH, NOT AN ORDINARY ACTION
Manual order creation exists for a payment taken out of band — a bank transfer, a cash payment, a
correction. It sits behind `config.update`, a configuration permission, not a reporting one. So:
  - the create affordance is a secondary button, never the page's primary action;
  - the form carries a permanent Warning-tinted note: "Creating an order here records a payment
    the gateway does not know about. Use it only to reconcile a payment taken outside the
    platform.";
  - the form takes major units and converts, because an operator reads an amount off an invoice,
    not off a webhook payload — show the minor-unit value that will be sent as a monospace
    caption beneath the amount field so there is no ambiguity;
  - currency is exactly three characters, uppercased on submit;
  - the default status is pending, and choosing anything else requires a caption explaining that
    it bypasses the gateway lifecycle.

THERE IS NO UPDATE, NO DELETE, AND NO SINGLE-ORDER READ
The API exposes list and create only. An order cannot be edited, cancelled, or deleted from this
console, and there is no endpoint that returns one order by id. So:
  - never draw an edit button, a status dropdown on a row, or a delete action;
  - the order detail screen is built from the row already in the list, and must say so;
  - where a correction is needed, the honest path is a new reconciling order plus a note, and the
    UI should say that rather than implying an edit exists.

DATA REALISM
Amounts like 12,499.00 INR, 349.00 USD, 89.00 USD. External IDs in monospace matching real
gateway shapes: "pi_3Q8xR2Kf9mNq", "pay_PkL2mR8vT4nXaZ", "order_NqW7pL3kY". Membership IDs as
8-character UUID fragments in monospace. Timestamps spread across today, yesterday, and the last
fortnight. A realistic ledger has mostly paid rows, a steady trickle of pending, a few failed,
and one or two orders with no external ID at all.
```

---

## Screen 1 — `/admin/reports/payments/orders` (the ledger)

```text
Screen: Payment orders. Route /admin/reports/payments/orders. Desktop 1440px, admin sidebar with
"Reports" expanded and "Payments" active.

HEADER
Breadcrumb: Admin / Reports / Payments / Orders. Title "Payment orders", subtitle "The raw ledger
rows gateway webhooks settle against." Right side: a secondary "Record a manual order" button and
a secondary "Export CSV" button. There is deliberately no primary button on this screen — the
ledger is a reading surface.

PAYMENTS TAB STRIP — the module's own nav, underline style, horizontally scrollable: Overview ·
Transactions · Orders · Instalments · Gateways · Invoices · Refunds · Exports, with "Orders"
active in Accent Indigo.

SCOPE NOTE — a slim Sunken Surface strip directly beneath the tab strip, one line in Muted Ink:
"Orders are the raw ledger rows gateways settle against. Learner, product and gateway detail
lives in Transactions." Not dismissible.

SIGNAL BAND — unequal cells, first double width, and every figure derived from the loaded page
rather than a server total, with a caption saying so:
"Loaded 50 orders" at 32px monospace with the caption "more may exist — this list is cursor
paginated" | "Pending 7" in Warning, clickable to filter | "Failed 3" in Danger, clickable |
"No external ID 2" in Warning with the caption "webhooks cannot settle these", clickable through
to the unmatched screen | "Paid-at mismatch 1" in Warning with a caption naming the kind.
A Muted Ink line beneath the band reads: "Counts reflect the orders loaded so far, not the whole
ledger."

FILTER BAR — a Sunken Surface strip:
  - a "Status" select with exactly six options — All statuses, Pending, Paid, Failed, Refunded,
    Cancelled — matching the real enum;
  - a search input with the placeholder "External ID or membership ID", filtering the loaded rows
    client-side with a caption noting it searches what is loaded;
  - a "Currency" select built from the currencies present in the loaded rows;
  - a "Settlement" select (Any, Has external ID, No external ID, Paid-at mismatch);
  - a "Refresh" secondary button.
Applied filters render as removable chips beneath with "Clear all".

TABLE — one order per row, columns matching the real fields exactly:
[checkbox] | Created (absolute date and time in monospace with a relative caption) | Amount
(monospace right-aligned with the currency code suffix) | Currency | Status pill, with a small
Warning caption beneath where paidAt and status disagree | Membership (an 8-character monospace
UUID fragment with a copy icon, or "Not linked" in Muted Ink) | External ID (monospace with a
copy icon, or "No external ID" in Warning with the caption "Webhooks cannot settle this order") |
Paid (absolute timestamp in monospace, or an em dash) | a kebab (Open order, Open in Transactions,
Copy order ID, Copy external ID).
Rows click through to the order detail. Rows that are pending with a null external ID carry a
Warning left rail; failed rows carry a Danger rail. Sorting is by created descending and is not
adjustable, because the cursor orders the feed — say so in a Muted Ink caption at the table foot.
Show 12 rows: seven paid, two pending (one of them with no external ID and a Warning rail), one
failed, one refunded, one cancelled, and one paid row whose Paid cell is an em dash carrying the
"Marked paid without a timestamp" caption.

END OF LIST — a single "Load more" secondary button, full width on mobile and auto-width centred
on desktop, with a busy state that keeps its size. When there is no next cursor the button is
absent and a Muted Ink line reads "End of the ledger for these filters." No paginator anywhere.

SELECTION BAR (render visible): "4 orders selected · 38,412.00 INR" with "Export selection" and
"Clear" — and nothing else, because no bulk mutation exists.

ALSO PRODUCE as separate frames:
A. Loading — the header, tabs, scope note, and filter bar live, with eight skeleton rows matching
   the exact column widths.
B. Empty ledger — a line-art mark of a blank ledger line, heading "No payment orders yet", the
   sentence "Orders appear when a learner checks out, or when one is recorded manually for a
   payment taken outside the platform.", and a secondary "Record a manual order".
C. Empty filter — "No orders match these filters" with a "Clear filters" button, the signal band
   and filter bar retained.
D. Error — an inline Danger strip reading "Could not load orders." with a Retry button, replacing
   the table.
E. Multi-currency — the same table with INR, USD and one unrecognised three-letter code, the last
   rendering with plain formatting plus the code appended rather than a blank cell, and the
   selection bar showing two stacked per-currency subtotals instead of one figure.
F. Mobile 390px — the filter bar collapses to a status select plus a "Filters" button opening a
   bottom sheet; each order becomes a card with amount and currency as the headline, status pill,
   external ID, membership fragment, and created date; the "Load more" button full width.
```

---

## Screen 2 — `/admin/reports/payments/orders/new`

```text
Screen: Record a manual order. Route /admin/reports/payments/orders/new. Produce it as a
right-side drawer over the ledger, and also as a standalone page for deep links. This is the
reconciliation escape hatch, and the design must carry that weight without becoming alarming.

HEADER
Drawer header: "Record a manual order" with a close x. Page variant: breadcrumb Admin / Reports /
Payments / Orders / New, title "Record a manual order", subtitle "For a payment taken outside the
platform."

PERMISSION AND PURPOSE NOTE — a Warning-tinted strip at the top of the form, two lines, before
any field: "Creating an order here records a payment the gateway does not know about. Use it only
to reconcile a payment taken outside the platform." A Muted Ink second line adds: "This action
requires the configuration permission, not an ordinary reporting one."

FORM — a single column, five controls, generously spaced:
  1. "Amount" — a numeric input taking major units, with the currency code shown as a suffix
     inside the field, and a monospace caption beneath reading "Sends 1249900 minor units" that
     updates live as the amount is typed. A Danger caption appears for a negative or
     non-numeric value: "Enter a valid amount."
  2. "Currency" — a three-character text input, uppercased as typed, defaulting to USD, with a
     caption "Exactly three characters. Uppercased on submit." and a datalist of the currencies
     already present in the ledger as suggestions, while still accepting any three-letter code.
  3. "Membership ID" — an optional field, presented as a searchable learner combobox showing
     avatar, name, and email, with the resolved UUID displayed in monospace beneath, plus a
     "paste an ID instead" text toggle that swaps it for a plain UUID input. A caption reads
     "Optional. An order with no membership is not attached to a learner."
  4. "External ID" — an optional monospace input, up to 256 characters, with the most important
     helper text on the screen: "The gateway reference webhooks match on. Leave it empty only if
     no gateway was involved — an order with no external ID can never be settled automatically."
     When the field is empty, a Warning caption appears beneath it restating that consequence.
  5. "Status" — a select of the five real statuses, defaulting to Pending, with a caption that
     changes with the selection. For Pending: "Waits for a gateway webhook, or for manual
     reconciliation." For anything else: a Warning caption reading "Recording an order directly
     as <status> bypasses the gateway lifecycle. Only do this when reconciling a payment that has
     already completed elsewhere."

FOOTER — sticky, with Cancel and a primary "Record order", the primary disabled until a valid
amount and a three-character currency are present.

CONFIRMATION MODAL — restates the whole record before committing: amount with currency, the minor
units in monospace, the status, the membership if set, the external ID if set. Where the external
ID is empty, a Warning line reads "No external ID — this order cannot be settled by a webhook."
Where the status is not pending, a second Warning line names the bypass. Then Cancel and a primary
"Record order". Produce a busy variant.

ALSO PRODUCE: the success state — the drawer closing with a toast "Payment order created" and the
new row highlighted in Accent Wash at the top of the ledger behind; a validation state with the
amount error visible; a create-failure state with an inline Danger strip inside the drawer
preserving every entered value; a permission-denied state where the whole form is replaced by a
centred panel reading "You do not have permission to record orders" with a sentence naming the
configuration permission and a secondary "Back to orders"; and a 390px mobile frame where the
drawer is a full-screen sheet with the footer pinned.
```

---

## Screen 3 — `/admin/reports/payments/orders/[orderId]`

```text
Screen: Order detail. Route /admin/reports/payments/orders/[orderId]. Back text-link "All orders".
Produce two variants: a healthy paid order, and a pending order with no external ID — the fault
case this whole module exists to surface.

HEADER
Breadcrumb: Admin / Reports / Payments / Orders / 8F2A41C9. Title: the order ID at 20px monospace
with a copy button. Beneath it a chip cluster: the status pill, the currency, and the created
date. Right: secondary "Open in Transactions", secondary "Copy external ID" (absent entirely when
there is none), and a secondary "Record a reconciling order".

SOURCE NOTE — a Sunken Surface strip beneath the header, one line in Muted Ink: "Built from the
ledger list. There is no single-order endpoint yet, so this view shows the fields the list
returns." Not dismissible — it is honest about why the page is sparse.

AMOUNT BAND — unequal cells, first double width: the amount at 32px monospace with the currency
code beneath and a caption showing the stored minor units in monospace ("1249900 minor units") |
"Status Paid" as a large pill | "Created 22 Jul 2026, 14:38" | "Paid 22 Jul 2026, 14:38:46", or
an em dash with a Warning caption where null | "Membership" showing the UUID fragment with a copy
icon, or "Not linked".

SETTLEMENT PANEL — the heart of the screen, a Panel Surface block titled "Settlement":
  - a label/value row for External ID in monospace with a copy icon, or — in the fault variant —
    the words "No external ID" at 16px in Warning with a full sentence beneath: "Stripe and
    Razorpay webhooks find an order by its external ID. Without one, no webhook can move this
    order out of pending.";
  - a plain-language state line naming what will happen next: for a healthy paid order, "Settled
    by webhook on 22 Jul 2026"; for the fault variant, "Nothing will settle this order
    automatically.";
  - a consistency check rendered as two or three rows with a pass or warn marker each — "Status
    and paid-at agree", "External ID present", "Amount is a non-negative integer" — each with a
    one-line explanation. Failing checks render in Warning with the mismatch named.
  - a closing Muted Ink line: "Orders cannot be edited or deleted. To correct one, record a
    reconciling order and note the original."

RAW RECORD PANEL — a Sunken Surface block holding the eight fields exactly as returned, as a
monospace key/value list with a copy-all button: id, membershipId, externalId, amountCents,
currency, status, paidAt, createdAt. A caption notes that `metadataJson` can be set on creation
but is not returned by the list, so it cannot be shown here.

RELATED — a right rail at 32% with three chevron rows: "Open in Transactions" with a caption
naming what extra detail it carries; "Open the learner's member profile", disabled with a caption
where membershipId is null; and "Gateway webhook log", carrying a Muted caption that no webhook
log exists yet.

ALSO PRODUCE: loading skeleton; a not-found state where the id is not in the loaded ledger,
showing a centred panel reading "That order is not in the loaded list" with a sentence explaining
that the ledger is cursor-paginated and the order may be further back, plus a primary "Back to
orders"; and a 390px mobile frame where the right rail stacks beneath the settlement panel.
```

---

## Screen 4 — `/admin/reports/payments/orders/unmatched`

```text
Screen: Unmatched orders. Route /admin/reports/payments/orders/unmatched. The reconciliation
worklist — orders a webhook can never settle, and orders stuck where they should not be.

HEADER
Breadcrumb: Admin / Reports / Payments / Orders / Unmatched. Title "Unmatched orders", subtitle
"Orders no webhook can settle, and orders whose status and timestamp disagree." Right: secondary
"Export CSV", secondary "Record a manual order".

DERIVATION NOTE — a Sunken Surface strip beneath the header, one line in Muted Ink: "These groups
are derived from the orders loaded so far. Load more on the ledger to widen the scan." Not
dismissible, because every count on this screen is a client-side scan rather than a server query.

SIGNAL BAND — unequal cells: "Needs attention 6" at 32px monospace in Warning with the caption
"across 50 loaded orders" | "No external ID 2" in Warning | "Pending over 7 days 3" in Warning |
"Paid-at mismatch 1" in Warning | "Oldest 14 days" with the order ID beneath in monospace.

GROUPED WORKLIST — the primary object, one Panel Surface block per fault group, each with a
hairline header carrying the group name, its count, and a one-sentence explanation of why it
matters:
1. "No external ID" — "Stripe and Razorpay match on external ID. These orders cannot be settled
   automatically and will stay pending until someone reconciles them by hand."
2. "Pending for more than 7 days" — "A gateway usually settles or fails within minutes. A
   long-pending order with an external ID suggests a webhook was never received."
3. "Status and paid-at disagree" — "Either a paid order has no timestamp, or an unpaid order
   carries one. Both point at a partial settlement."
Inside each block, rows in the ledger's own column shape but trimmed to what matters: Created |
Amount with currency | Status pill | External ID (or the Warning treatment) | Paid | Age in
monospace days | a kebab (Open order, Open in Transactions, Copy external ID, Record a reconciling
order). Rows carry a Warning left rail throughout.
Show two rows in the first group, three in the second, one in the third.

WHAT TO DO PANEL — beneath the groups, a Sunken Surface block titled "How these get fixed",
holding three plain steps as numbered rows, because this console cannot fix them itself: check
the gateway dashboard for the payment using the external ID or the amount and date; if the
payment did complete, record a reconciling order with the correct external ID and status; if it
did not, leave the order pending or record a cancelling entry and note the original. A closing
Muted Ink line states that orders cannot be edited or deleted here, which is why the second and
third steps create a new record rather than changing one.

ALSO PRODUCE: the all-clear state — every group replaced by a single Success-marked line each
("No orders without an external ID", "Nothing pending beyond 7 days", "No status mismatches") with
the signal band showing zeros and a Success caption reading "Nothing needs reconciling in the
loaded orders"; a loading skeleton; and a 390px mobile frame where each fault row becomes a card
and the "How these get fixed" steps stack.
```

---

## Backend gaps these prompts assume

| Prompt feature                                                                                                      | Status                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| List payment orders with `status`, `cursor`, `limit` (1–100, default 50) and a `nextCursor`                         | exists                                                                                                                               |
| Create a payment order (`amountCents`, `currency`, `status`, optional `membershipId`, `externalId`, `metadataJson`) | exists, behind `config.update`                                                                                                       |
| The five-value status enum (pending / paid / failed / refunded / cancelled)                                         | exists                                                                                                                               |
| Stripe and Razorpay webhooks settling an order by `externalId`                                                      | exist                                                                                                                                |
| **Read one order by id**                                                                                            | **missing** — Screen 3 is built from the loaded list and says so in its source note                                                  |
| **Update or delete an order**                                                                                       | **missing** — no edit, no cancel, no delete anywhere in the design; corrections are new reconciling records                          |
| `metadataJson` returned on read                                                                                     | missing — it is accepted on create but absent from `paymentOrderDtoSchema`                                                           |
| Server-side counts or totals                                                                                        | missing — cursor pagination returns no total, which is why every figure on Screens 1 and 4 is captioned as covering loaded rows only |
| Server-side search on external ID or membership                                                                     | missing — the search on Screen 1 is client-side over loaded rows                                                                     |
| An unmatched or stuck-order query                                                                                   | missing — Screen 4's three groups are a client-side scan, which is honest but only as wide as what has been loaded                   |
| Webhook delivery log per order                                                                                      | missing — the related rail names it as absent                                                                                        |
| CSV export of orders                                                                                                | missing                                                                                                                              |

Two notes for whoever builds this. First, the single most valuable backend addition is a
**server-side unmatched query** — the fault groups on Screen 4 are exactly the thing an operator
needs and exactly the thing a client-side scan over one cursor page cannot reliably find. Second,
`currency` is `z.string().length(3)` with no enum, so the formatter must keep the existing
fallback: an unrecognised code formats plainly with the code appended rather than throwing and
blanking the row.
