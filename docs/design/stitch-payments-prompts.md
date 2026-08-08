# Google Stitch Prompts — Payments (`/admin/reports/payments`)

Paste **Block 0 (Design System)** into Stitch first, then **Block 0-P (Payments addendum)**,
then one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in [stitch-active-devices-prompts.md](./stitch-active-devices-prompts.md)
and is reproduced here so this file stands alone.

Source of truth:
- `frontend/apps/web/src/features/admin/reports/AdminPaymentsRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-payments-roster-api.ts`
- `backend/packages/domain/src/payments/*`
- `backend/apps/api/src/app/api/v1/reports/payments/*`

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
- Success            #15803D / #62DF7D   — paid, settled, healthy status
- Warning            #B45309 / #E6C364   — pending, overdue, requires attention
- Danger             #DC2626 / #FF8A80   — failed, refunded, disputed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, IDs, invoice numbers, timestamps: JetBrains Mono.
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
- Every destructive or money-moving action opens a confirmation modal that names the exact
  objects and amounts affected and states the consequence in plain words.

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

## Block 0-P — Payments addendum (paste second)

```text
PAYMENTS MODULE ADDENDUM — applies to every screen in /admin/reports/payments

MONEY RENDERING
- All amounts monospace, tabular figures, right-aligned in tables, decimal points aligned
  down the column. Currency code as a 11px Muted Ink suffix: "12,499.00 INR", "349.00 USD".
  Never a bare glyph without the code — this tenant transacts in several currencies.
- Negative and refunded amounts render in Danger with a leading minus: "−349.00 USD".
- Totals rows use 600 weight and sit above a 2px Hairline top border, never a filled band.
- Mixed-currency lists never sum into a single figure; show per-currency subtotals stacked,
  with a caption "Converted at the rate recorded on the transaction date."

STATUS TAXONOMY (use these exact labels and colours everywhere)
- Paid / Settled / Completed — Success
- Pending / Processing / Awaiting capture / Scheduled — Warning
- Overdue / Past due — Warning with a Danger left rail on the row
- Failed / Cancelled / Refunded / Partially refunded / Disputed / Chargeback — Danger
- Draft / Archived — Muted Ink on Sunken Surface
Gateway states: Published (Success), Configured (Warning), Draft (Muted), Disabled (Danger).

GATEWAYS
Real gateway set: Stripe, Razorpay, PayPal, Cashfree, PayU. Render each with a small
monochrome wordmark chip in Muted Ink — never brand-coloured logos, never a coloured card.

DATA REALISM
Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua".
Products like "Funded Trader Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp".
Invoice numbers "INV-2026-004182". Order IDs as 8-char monospace fragments. Amounts like
12,499.00 INR / 349.00 USD / 89.00 USD. Percentages like 6.4%, 18.2%, 2.7%.

MONEY-MOVING SAFETY
Any action that records, refunds, or voids money must (1) restate the exact amount, currency,
learner, and product in the confirmation modal, (2) require an explicit reason where a reason
field exists, and (3) show an irreversible-action caption. Never a one-click money action
directly from a table row.
```

---

## Screen 1 — `/admin/reports/payments` (overview)

```text
Screen: Payments — report overview. Route /admin/reports/payments. Desktop 1440px, admin
sidebar with "Reports" expanded and "Payments" active.

HEADER
Breadcrumb: Admin / Reports / Payments. Title "Payments", subtitle "Revenue, transactions,
instalment plans, gateways, and invoices across the tenant." Right side: a date-range picker
button reading "1 Jul – 4 Aug 2026" with a caret, a currency select ("All currencies", "INR",
"USD"), a secondary "Export" button, and a primary "Record payment" button.

MODULE TAB STRIP (shared by every screen in this module, directly under the header)
Overview · Transactions · Instalments · Gateways · Invoices · Refunds · Exports.
Underline-style tabs, active tab in Accent Indigo with a 2px underline, inactive in Muted Ink.

REVENUE BAND (not three equal cards)
One Panel Surface band split by vertical hairlines into unequal cells; the first is double
width: "Collected this period" — 41,86,200.00 INR in 32px monospace, with a delta caption
"+14.2% vs previous 35 days" in Success, and a thin Accent Indigo area chart of daily
collections behind the lower third of the cell. Then: "Transactions 1,284", "Average order
3,262.00 INR", "Outstanding instalments 6,42,000.00 INR" in Warning with a caption
"48 plans", "Failed 37" in Danger with a caption "2.7% of attempts".

MAIN GRID — asymmetric 62/38
LEFT COLUMN, two stacked panels:
1. "Revenue over time" — a combined chart: stacked bars per day coloured by product type
   (Course, Bundle, Subscription, Live class) with a thin line overlay for order count on a
   secondary axis. Legend as a single inline row above the plot, not a boxed legend. A
   segmented granularity control (Day / Week / Month) top-right of the panel.
2. "Recent transactions" — a compact 8-row table: Learner (name over email), Product,
   Gateway chip, Amount, Status pill, Date (relative + absolute monospace). Panel footer
   holds a "View all transactions" text link aligned right.
RIGHT COLUMN, three stacked panels:
1. "Revenue by gateway" — horizontal bars, one per gateway, each row showing the gateway
   wordmark chip, the bar, the amount, and the share percentage. No pie chart, no donut.
2. "Top products" — a ranked list of 5 with rank numeral in monospace, product title, units,
   and revenue; the leader gets an Accent Wash row tint.
3. "Needs attention" — a short action list: "12 invoices unsent", "9 instalments overdue",
   "4 failed payments in the last 24 hours", "1 gateway in Draft"; each row has a right-side
   chevron and links to a filtered view.

ALSO PRODUCE as separate frames:
A. Loading — skeleton band, chart placeholder blocks, skeleton table rows.
B. Empty — line-art receipt-and-coin mark, "No payments in this range", one sentence, a
   primary "Reset date range" button.
C. Error — inline Danger strip "Couldn't load payment data." with Retry.
D. Mobile 390px — revenue band as a two-up grid, charts full width, tab strip horizontally
   scrollable, recent transactions as stacked cards.
```

---

## Screen 2 — `/admin/reports/payments/transactions`

```text
Screen: Transactions ledger. Route /admin/reports/payments/transactions. Same shell, module
tab strip active on "Transactions".

HEADER
Title "Transactions", subtitle "Every payment attempt recorded against a learner order."
Right: date-range picker, secondary "Columns" button, secondary "Export CSV" button, primary
"Record payment".

FILTER BAR
Sunken Surface strip: search input ("Search learner, email, invoice number, or order ID"),
"Date field" select (Transaction date / Created date), From date, To date, "Status"
multi-select (Paid, Pending, Failed, Refunded, Partially refunded, Cancelled), "Gateway"
multi-select (Stripe, Razorpay, PayPal, Cashfree, PayU), "Product type" select (Course,
Bundle, Subscription, Live class), "Currency" select, "Amount between" dual numeric inputs,
and an "Add filter" ghost button that appends a field/operator/value row. Applied filters
show as removable chips beneath with "Clear all" and "Save as view". A saved-view tab row
above the table: "All" (active), "Failed today", "Refund candidates", "High value",
"+ New view".

COLUMNS POPOVER — produce one frame with it open: a two-column checkbox list matching the
real column set (Learner, Email, Product, Product type, Gateway, Coupon amount, Amount, Tax,
Currency, Status, Invoice #, Transaction date, Created), drag handles for reordering, a
"Reset to default" text button, and Apply.

TABLE
[checkbox] | Learner (name over email in Muted Ink) | Product (title over a product-type chip)
| Gateway (wordmark chip + the external payment ID beneath in 11px monospace, truncated with
a copy icon) | Coupon (negative amount in Danger, or an em dash) | Amount (monospace, right
aligned, with the tax amount beneath as "incl. tax 1,905.00") | Currency | Status pill |
Invoice # (monospace link, or "Not issued" in Muted Ink) | Transaction date (relative +
absolute) | kebab (View transaction, Download invoice, Issue invoice, Refund, Resend receipt,
Open member profile, Copy order ID). Sortable headers on Amount, Coupon, and Transaction
date; active sort = Transaction date descending. Show 12 rows spanning every status, at least
two currencies, and one refunded row rendered with a faint Danger tint and a strikethrough on
the original amount with the net beneath.

FOOTER
Left: a per-currency total strip — "Page total: 3,84,200.00 INR · 2,145.00 USD" and beneath
it in Muted Ink "Filtered total: 41,86,200.00 INR · 18,904.00 USD". Middle: page-size select.
Right: paginator.

SELECTION BAR (render visible): "4 transactions selected · 18,340.00 INR" with right-side
"Issue invoices", "Export selection", "Refund", "Clear".

ALSO PRODUCE: loading skeleton, empty state ("No transactions match these filters"), inline
error strip, and a 390px mobile frame where each transaction is a card showing learner,
product, amount, status pill, gateway chip, and date.
```

---

## Screen 3 — `/admin/reports/payments/transactions/[orderId]`

```text
Screen: Transaction detail. Route /admin/reports/payments/transactions/[orderId]. Produce
BOTH a right-drawer version over the ledger and a standalone full page for deep links.

HEADER
Title "Order 8F2A41C9" in monospace with a copy button, a Status pill ("Paid"), and beneath
it a Muted Ink line: "Stripe · pi_3Q8xR2Kf · 22 Jul 2026, 14:38 IST". Right side: secondary
"Download invoice", secondary "Resend receipt", destructive-outline "Refund".

AMOUNT SUMMARY
A Sunken Surface block: the gross amount at 28px monospace, then a line-item breakdown as
label/value rows — Subtotal, Coupon "SUMMER15" as a negative in Danger, Tax (GST 18%),
Gateway fee, Net settled — with a 2px top border above the final "Total charged" row in 600
weight. To the right of the block, a small vertical settlement timeline: Authorised →
Captured → Settled, with monospace timestamps and the pending step rendered as a hollow node.

BODY — hairline-separated sections of two-column label/value rows:
- Learner: avatar chip, display name, email, membership ID (monospace + copy), a "View member
  profile" text link, and enrolment status.
- Product: title, product type chip, pricing plan label, quantity, access granted on, and a
  link to the product.
- Billing: billing name, company, tax ID / GSTIN, billing address, country.
- Gateway: gateway wordmark chip, payment method ("Visa •••• 4242" or "UPI · okhdfcbank"),
  external payment ID, external customer ID, capture mode, risk score with a pass/review pill.
- Metadata: a Sunken Surface JSON block showing the raw gateway payload, collapsed to 6 lines
  with a "Expand raw payload" text toggle and a copy button.

EVENT TIMELINE
A vertical timeline with monospace timestamps on the left rail: order created; checkout
started; payment authorised; payment captured; invoice INV-2026-004182 issued; receipt
emailed to the learner; access granted to "Funded Trader Foundations". Failure and refund
events get a Danger rail dot. Entries triggered by an admin are stamped with the admin name.

STICKY FOOTER (drawer version): secondary "Copy order ID", secondary "Issue invoice",
destructive "Refund payment".

ALSO PRODUCE: the "Refund payment" modal — title "Refund this payment?", a refund-type
segmented control (Full / Partial), an amount field pre-filled with the full amount and
capped, a "Reason" select (Duplicate charge / Learner request / Course cancelled / Fraud /
Other) with a required note field when Other is chosen, a "Revoke course access" checkbox, a
"Notify the learner by email" checkbox checked by default, an irreversible caption "Refunds
are sent to the original payment method and cannot be undone from this console.", then Cancel
and a solid Danger "Refund 12,499.00 INR" button that names the amount. Plus a busy variant
and a failed-refund variant showing the gateway error message inline.
```

---

## Screen 4 — `/admin/reports/payments/invoices`

```text
Screen: Invoice register. Route /admin/reports/payments/invoices. Module tab active on
"Invoices".

HEADER
Title "Invoices", subtitle "Every invoice issued against a paid order. Numbering is automatic
and sequential." Right: date-range picker, secondary "Columns", secondary "Export CSV",
secondary "Invoice settings" (links to billing settings), primary "Issue invoice".

FILTER BAR
Search ("Search invoice number, learner, email, or billing name"), From / To dates, "Status"
select (Issued, Sent, Viewed, Void), "Currency" select, "Product" combobox, and "Add filter".
Applied-filter chips beneath.

TABLE
[checkbox] | Invoice # (monospace Accent Indigo link) | Learner (name over email) | Billing
name (with a "differs from learner" caption in Muted Ink where relevant) | Product | Price
(monospace right-aligned) | Tax (with the rate beneath, "GST 18%") | Currency | Issued date |
Status pill | actions (a "Download" text button plus a kebab: Preview, Download PDF, Download
HTML, Resend to learner, Copy invoice link, Void invoice).
Show 10 rows including one Void row, dimmed with a strikethrough invoice number.
Footer with per-currency page and filtered totals, page-size select, and paginator.

SELECTION BAR: "6 invoices selected" with "Download as ZIP", "Resend to learners",
"Export selection", "Clear".

ALSO PRODUCE: empty state — line-art invoice mark with "No invoices yet" and the sentence
"Paid orders receive invoice numbers automatically. Issue one manually for an offline
payment."; a loading skeleton; and a mobile 390px card list.
```

---

## Screen 5 — `/admin/reports/payments/invoices/[invoiceId]`

```text
Screen: Invoice preview. Route /admin/reports/payments/invoices/[invoiceId]. A full page,
asymmetric 58/42.

LEFT — a paper preview of the invoice rendered on an off-white sheet (#FFFDF8 light /
#F3EFE6 dark) inside a Panel Surface frame with generous padding, at A4 aspect ratio:
tenant logo top-left, "TAX INVOICE" label top-right with the invoice number and issue date in
monospace, "Billed to" and "Billed from" address blocks side by side, a line-item table
(description, quantity, unit price, tax, amount) with a totals stack (Subtotal, Discount, Tax,
Total, Amount paid, Balance due 0.00), a payment-received stamp line, and a footer with tax
registration numbers and terms. Above the sheet a thin toolbar: zoom out / zoom percentage /
zoom in, page indicator, and a "Open in new tab" text button.

RIGHT — three stacked panels:
1. "Actions" — primary "Download PDF", secondary "Download HTML", secondary "Resend to
   learner" (with a caption showing the last send: "Sent to priya@example.com on 22 Jul 2026,
   14:41"), secondary "Copy shareable link" with the URL in a monospace field, and a
   destructive-outline "Void invoice".
2. "Details" — label/value rows: linked order ID (monospace link to the transaction detail),
   payment status pill, gateway chip, currency, tax treatment, place of supply, issued by,
   issued at.
3. "Delivery history" — a timeline: invoice generated; emailed to learner; email delivered;
   invoice viewed by learner; reminder sent. Bounced or failed deliveries get a Danger dot and
   an inline "Retry send" text button.

ALSO PRODUCE: the "Void invoice" modal — restates the invoice number, learner, and amount,
requires a reason select (Issued in error / Duplicate / Amount incorrect / Order refunded),
warns "Voiding keeps the invoice number reserved for audit and cannot be reversed.", then
Cancel and a solid Danger "Void invoice". And a mobile 390px frame where the paper preview
collapses to a scrollable card with the action panel pinned as a bottom bar.
```

---

## Screen 6 — `/admin/reports/payments/instalments`

```text
Screen: Instalment plans. Route /admin/reports/payments/instalments. Module tab active on
"Instalments".

HEADER
Title "Instalment plans", subtitle "Track split payments, remaining balances, and overdue
schedules." Right: secondary "Columns", secondary "Export CSV", primary "Create plan".

SIGNAL STRIP — unequal cells: "Outstanding balance" 6,42,000.00 INR at 32px monospace with a
caption "across 48 active plans" (double-width cell) | "Due in the next 7 days 1,18,400.00
INR" | "Overdue 87,200.00 INR" in Danger with a caption "9 instalments" and clickable to
filter | "Completed this month 23".

FILTER BAR
Search ("Search learner, email, or product"), "Status" select (Active, Completed, Overdue,
Cancelled), "Pricing plan" select (2 instalments, 3 instalments, 6 instalments, Custom),
"Product" combobox, "Next due" select (Overdue, Next 7 days, Next 30 days), "Currency"
select, "Add filter". Applied-filter chips beneath.

TABLE
[checkbox] | Learner (name over email) | Product (title over product-type chip) | Pricing plan
| Progress (a 4px-tall segmented bar — one segment per instalment, Success for paid, Outline
for unpaid, Danger for overdue — with "2 of 4 paid" beneath in 11px monospace) | Paid /
Total (monospace, "5,000.00 / 12,499.00 INR") | Remaining (monospace, Warning weight) | Next
due (date with a relative caption; overdue rows show "9 days overdue" in Danger and get a
Danger left rail on the row) | Status pill | kebab (View schedule, Record next payment, Send
payment reminder, Edit schedule, Cancel plan).
Show 10 rows including two overdue and one completed. Footer with per-currency outstanding
totals, page-size select, paginator.

SELECTION BAR: "3 plans selected" with "Send reminders", "Export selection", "Clear".

ALSO PRODUCE: empty state — "No instalment plans yet", sentence "Create a plan to split a
purchase into scheduled payments.", primary "Create plan"; loading skeleton; mobile card list
where the progress bar sits full width across the card.
```

---

## Screen 7 — `/admin/reports/payments/instalments/[planId]`

```text
Screen: Instalment plan detail. Route /admin/reports/payments/instalments/[planId]. Full page,
asymmetric 66/34.

HEADER
Breadcrumb: Admin / Reports / Payments / Instalments / Plan 4C21. Title: the product title,
with the learner name and email beneath in Muted Ink, plus pills "Active", "3 instalments",
"9 days overdue" in Danger. Right: secondary "Send reminder", secondary "Edit schedule",
destructive-outline "Cancel plan", primary "Record next payment".

PLAN SUMMARY BAND — unequal cells: "Remaining 7,499.00 INR" at 28px monospace (double width,
with a horizontal progress bar beneath showing 40% collected and the caption "5,000.00 of
12,499.00 INR collected") | "Next due 12 Aug 2026" | "Instalments 1 of 3 paid" | "Created
14 Jun 2026 by Nandita Rao".

LEFT COLUMN — the schedule table, one row per instalment:
# (monospace sequence number) | Amount | Due date (with a relative caption) | Paid date |
Payment (linked order ID in monospace, or an em dash) | Status pill (Paid / Scheduled /
Overdue / Failed) | action (a "Record payment" secondary button on the next unpaid row only;
a kebab elsewhere with Edit amount, Change due date, Mark as paid, Send reminder). The next
actionable row carries an Accent Indigo left rail; overdue rows carry a Danger rail and a
faint Danger tint. A totals row beneath the table: Total, Collected, Remaining.

RIGHT COLUMN — three stacked panels:
1. "Learner" — avatar chip, name, email, membership ID (monospace + copy), enrolment status,
   a "View member profile" link, and a "Course access: Active while plan is current" caption.
2. "Reminders" — the reminder cadence in effect ("3 days before due, on due date, 3 days
   after"), a toggle to pause reminders for this plan, and a list of the last three reminders
   with delivery status pills.
3. "Activity" — a timeline: plan created; instalment 1 paid via Razorpay; reminder sent;
   instalment 2 failed — card declined; due date extended by admin. Danger dots on failures.

ALSO PRODUCE:
- The "Record next payment" modal — restates instalment number, amount, currency, learner, and
  product; a "Payment method" select (Gateway charge / Bank transfer / Cash / Adjustment); a
  gateway select shown only for gateway charge; a reference field; a paid-on date picker
  defaulting to today; a "Send receipt to learner" checkbox checked by default; Cancel and a
  primary "Record 3,749.00 INR".
- The "Cancel plan" modal — restates the remaining balance, offers radio options "Keep course
  access" / "Revoke course access", requires a reason, warns that scheduled instalments will
  be voided, then Cancel and a solid Danger "Cancel plan".
```

---

## Screen 8 — `/admin/reports/payments/instalments/new`

```text
Screen: Create instalment plan. Route /admin/reports/payments/instalments/new. A focused
full-page form, single centred column at 840px max width — no sidebar collapse, but the
module tab strip stays visible and a "Cancel" text link sits top-right.

STRUCTURE — four numbered sections stacked vertically with hairline separators, each with a
short title and a one-line explanation. A slim sticky summary rail docks to the right at
280px on screens above 1200px, restating the running configuration.

1. LEARNER — a searchable combobox ("Search by name, email, or membership ID") that renders
   results as rows with avatar, name, email, and current enrolments. Once picked, the learner
   collapses into a selected card with a "Change" text button. Beneath it a read-only line
   showing existing plans for that learner, or "No existing plans".
2. PRODUCT & AMOUNT — a product combobox listing courses, bundles, and live classes with
   their list price; a "Product type" chip that fills automatically; a currency select; a
   "Total amount" money input pre-filled from the product with a "Differs from list price"
   caption in Warning when edited; and an optional "Pricing plan label" text field
   (placeholder "3 instalments").
3. SCHEDULE — a segmented preset control (2 / 3 / 6 / Custom instalments). Choosing a preset
   generates an editable instalment table: # | Amount (money input) | Due date (date picker) |
   a remove row button. A "Split evenly" text button, an "Add instalment" secondary button,
   and a live validation strip beneath the table that turns Danger when the instalment sum
   does not equal the total: "Instalments total 12,000.00 INR — 499.00 INR short of the plan
   total." Also a "First payment due" date picker and an interval select (Monthly / Every 2
   weeks / Custom) that regenerates the rows.
4. ACCESS & REMINDERS — radio: "Grant course access immediately" / "Grant access after the
   first payment" / "Grant access after the full plan is paid". Toggles: "Send reminders
   before each due date" (on) with a cadence select, "Revoke access automatically when an
   instalment is 14 days overdue" (off), "Email the schedule to the learner now" (on).

STICKY SUMMARY RAIL: learner name, product, total, instalment count, first and last due date,
and a per-instalment mini list. Footer of the rail: a primary "Create plan" button, disabled
until validation passes, and a "Save as draft" text button.

ALSO PRODUCE: an inline validation error state on the schedule table; a success state showing
a confirmation panel with the created plan summary and two buttons "View plan" and "Create
another"; and a 390px mobile frame where the summary rail becomes a collapsible bottom sheet
labelled "Plan summary — 12,499.00 INR".
```

---

## Screen 9 — `/admin/reports/payments/gateways`

```text
Screen: Payment gateways. Route /admin/reports/payments/gateways. Module tab active on
"Gateways".

HEADER
Title "Payment gateways", subtitle "Volume, settlement, and configuration status per
provider." Right: date-range picker, secondary "Gateway settings" linking to the payments
settings screen, primary "Connect a gateway".

LAYOUT — a comparison band followed by a list; no equal-card grid.
COMPARISON BAND: a single Panel Surface strip with one horizontal stacked bar showing the
share of collected volume across all gateways, segmented in graded tints of Accent Indigo
with the leader in the full accent, and an inline legend row beneath giving gateway name,
amount, and share percentage.

GATEWAY LIST — one full-width row per gateway, Panel Surface, 4px left rail coloured by state:
gateway wordmark chip and display name (with a "Default" pill where applicable); a status pill
(Published / Configured / Draft / Disabled); a compact metric cluster in monospace —
Transactions, Collected volume, Average order, Success rate, Refund rate — laid out as
label-above-value cells separated by hairlines; a 14-day sparkline; on the right a
"View transactions" secondary button and a kebab (Open settings, Set as default, Run test
charge, Disable gateway, View webhook log). Show all five: Stripe (Published, default),
Razorpay (Published), PayPal (Configured), Cashfree (Draft, rendered at reduced emphasis with
a "Finish setup" text button in place of the metrics), PayU (Disabled, dimmed).

BELOW THE LIST — a "Settlement health" panel: a table of the last 6 payouts across gateways —
Gateway | Payout ID (monospace) | Period covered | Gross | Fees | Net | Expected on | Status
pill (Paid out / In transit / Delayed). A caption links to the reconciliation view.

ALSO PRODUCE: empty state "No payment gateways connected" with a line-art plug mark and a
primary "Connect a gateway"; loading skeleton; mobile 390px frame where each gateway row
becomes a card with the metric cluster as a two-up grid.
```

---

## Screen 10 — `/admin/reports/payments/gateways/[gatewayKey]`

```text
Screen: Gateway detail. Route /admin/reports/payments/gateways/[gatewayKey]. Module tab active
on "Gateways", with a back text-link "All gateways".

HEADER
Gateway wordmark chip at 32px, display name "Razorpay" as page title, a status pill
"Published", a "Default gateway" pill, and beneath in Muted Ink the account identifier in
monospace with a copy button plus "Connected 14 Feb 2026 by Nandita Rao". Right: secondary
"Open settings", secondary "Export CSV", secondary "Run test charge", destructive-outline
"Disable gateway".

METRIC BAND — unequal cells: "Collected 24,18,900.00 INR" at 32px monospace with a delta
caption (double width) | "Transactions 812" | "Success rate 94.6%" with a caption "43 failed
attempts" | "Refund rate 1.8%" | "Fees 61,240.00 INR" with a caption "2.5% effective".

SUB-TAB STRIP inside the page: Transactions · Payouts · Webhooks · Configuration.

TAB 1 — TRANSACTIONS (default): the same ledger table as the main Transactions screen but
scoped to this gateway, with its own filter bar (date range, status, product type, amount
range, search) and the Gateway column removed. Include the columns popover, the per-currency
footer totals, and the selection bar.

TAB 2 — PAYOUTS: a table — Payout ID (monospace) | Period covered | Transactions | Gross |
Gateway fees | Tax on fees | Adjustments | Net paid out | Expected on | Settled on | Status
pill. An expandable row reveals the underlying transaction list. Above the table, a
reconciliation strip: "Ledger total 24,18,900.00 INR · Gateway reported 24,18,900.00 INR ·
Difference 0.00" rendered in Success, with a Danger variant frame showing a mismatch of
−1,240.00 INR and an "Investigate" button.

TAB 3 — WEBHOOKS: a list of recent webhook deliveries — timestamp (monospace), event type
(payment.captured, payment.failed, refund.processed, payout.settled), related order link,
HTTP response code pill, attempt count, and a "Replay" text button on failures. Above it, a
small strip showing the endpoint URL in a monospace field with a copy button, the signing
secret masked with a reveal toggle, and a "Send test event" secondary button.

TAB 4 — CONFIGURATION: read-only label/value rows summarising the connected account — mode
(Live / Test with a Warning pill on Test), supported currencies as chips, supported methods
as chips (Card, UPI, Netbanking, Wallet, EMI), capture mode, statement descriptor, refund
window — with an "Edit in settings" secondary button. Never show full API keys; show masked
values with the last 4 characters.

ALSO PRODUCE: the "Disable gateway" modal — warns that new checkouts will stop routing to this
gateway, states that in-flight payments and refunds continue, requires typing the gateway name
to confirm, then Cancel and a solid Danger "Disable Razorpay". And a mobile 390px frame.
```

---

## Screen 11 — `/admin/reports/payments/refunds`

```text
Screen: Refunds and disputes. Route /admin/reports/payments/refunds. Module tab active on
"Refunds".

HEADER
Title "Refunds and disputes", subtitle "Refund requests, processed refunds, and gateway
chargebacks in one queue." Right: date-range picker, secondary "Refund policy" link,
secondary "Export CSV", primary "Issue refund".

TRIAGE RAIL — 220px left rail listing queues with counts, active one in Accent Wash with an
Accent Indigo left rail: Open requests (7), Awaiting approval (3), Processing (2), Completed
(148), Failed (4), Disputes and chargebacks (2), Declined (11). A hairline separates open from
closed groups. Beneath the rail, a small "Exposure" block: "At risk 42,300.00 INR" in Warning
with the caption "open requests plus disputes".

MAIN — a list of full-width rows, each Panel Surface with a 4px severity rail:
a type pill (Refund request / Partial refund / Chargeback); the amount in 16px monospace with
the original order amount beneath as a struck-through Muted Ink figure where partial; the
learner name and email; the product title; the gateway wordmark chip; the reason as a chip
("Duplicate charge", "Course cancelled", "Learner request", "Fraud"); requested-on timestamp
(relative + absolute); an SLA caption in Warning where a dispute deadline is near ("Evidence
due in 3 days"); an assignee avatar or "Unassigned"; and on the right an "Approve" primary
button, a "Decline" secondary, and a kebab (View transaction, Request more information,
Assign to me, Add note). Show 6 rows across types including one chargeback with a Danger rail.
Checkbox at row start for bulk approval.

DETAIL DRAWER — produce one frame with a request expanded: the original transaction summary
(amount breakdown, gateway, date, invoice link), the requested refund amount with a partial/
full toggle, the learner's stated reason in a quoted block, course-access impact ("Access to
Funded Trader Foundations will be revoked"), an internal notes composer with existing notes
stamped by admin name and time, an evidence section for disputes (uploaded files listed with
name, size, and uploaded-by), and a sticky footer with "Decline" (secondary), "Request
information" (secondary), and "Approve refund — 12,499.00 INR" (solid Danger).

ALSO PRODUCE: the approve-confirmation modal restating amount, learner, gateway, and
irreversibility; a completed-queue empty state; and a mobile 390px frame where the triage rail
becomes a horizontally scrollable chip row.
```

---

## Screen 12 — `/admin/reports/payments/exports`

```text
Screen: Payment exports. Route /admin/reports/payments/exports. Module tab active on
"Exports".

HEADER
Title "Exports", subtitle "Download payment data or schedule recurring delivery to finance."
Primary "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Transactions / Invoices / Instalments / Gateway transactions / Refunds) | Scope
(a summary of applied filters, e.g. "Stripe · paid · 1 Jul – 4 Aug 2026") | Rows | Size |
Requested by | Created (relative + absolute) | Status pill (Queued / Building / Ready /
Failed / Expired) | action (Download, or Retry on failure). Show 7 rows covering every status;
the Building row carries a thin determinate Accent Indigo progress bar under the file name;
the Expired row is dimmed with "Files are deleted after 7 days".

RIGHT: "Scheduled exports" — stacked cards: name ("Monthly revenue reconciliation"), dataset
chip, cadence line ("On the 1st of each month, 06:00 Asia/Kolkata"), recipient chips (finance
email plus an accounting webhook), format chip, "Next run in 27 days" caption, an enabled
toggle, and a kebab (Edit, Run now, Duplicate, Delete). Show two schedules, one disabled at
reduced emphasis, then a dashed-border "New schedule" tile.

MODAL — "New export": a single grouped form. Dataset (segmented: Transactions / Invoices /
Instalments / Refunds / Gateway transactions, with a gateway select revealed for the last).
Columns (a two-column checkbox list matching the real column sets — for transactions: learner
name, email, product, product type, gateway, coupon amount, amount, tax, currency, status,
invoice number, transaction date, created — with "Select all" and a Warning caption beside
billing address and tax ID reading "Contains personal billing data"). Filters (a read-only
summary of the currently applied report filters with a "Use current filters" toggle, on, plus
an explicit date-range picker). Grouping (optional select: none / by gateway / by product /
by currency / by month, with a "Include per-group subtotals" checkbox). Format (segmented CSV
/ XLSX / JSON). Delivery (radio: Download now / Email me when ready / Send to recipients,
revealing an email chips input and an optional webhook URL). A "Schedule this export" toggle
revealing cadence, time, and timezone. Footer: Cancel and a primary "Create export".

ALSO PRODUCE: a ready toast "payments-transactions-2026-08-04.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
the schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature | Status |
| --- | --- |
| Transactions list, column picker, sort, date/name/type/gateway/status filters | exists |
| Invoices list, per-order invoice download (HTML) | exists |
| Instalment plans list, plan detail schedule, create plan, record next payment | exists |
| Gateways list with transaction count and paid volume, per-gateway transactions | exists |
| CSV export for all four datasets, async run polling | exists |
| Overview revenue charts, per-gateway share, top products, "needs attention" | needs backend aggregates |
| Transaction detail page — gateway payload, fees, event timeline, receipts | partly (`metadata_json`, `external_id`); timeline needs an event source |
| Refunds, disputes, chargebacks | **no refund domain at all** — needs backend |
| Invoice PDF, resend, void, shareable link, delivery history | only HTML download exists |
| Payouts, settlement reconciliation, webhook log | needs backend |
| Saved views, export history, scheduled exports | export runs exist; history UI and scheduling need backend |
| Instalment reminders, auto-revoke on overdue, edit schedule, cancel plan | needs backend |
| Multi-currency subtotals / conversion | `currency` is stored per order; conversion rates need backend |
