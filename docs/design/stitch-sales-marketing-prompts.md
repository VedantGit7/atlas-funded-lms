# Google Stitch Prompts — Sales & Marketing (`/admin/reports/sales-marketing`)

Paste **Block 0 (Design System)** first, then **Block 0-SM (Sales & Marketing addendum)**, then
one screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the Active Devices, Payments, Progress & Score, Batches, and
Polls files; reproduced here so this file stands alone.

Source of truth:
- `frontend/apps/web/src/features/admin/reports/AdminSalesMarketingRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-sales-marketing-roster-api.ts`
- `backend/packages/domain/src/reports/sales-marketing-roster.*`

Today the module is one page with five section tabs — Sales, Coupons, Referral & Wallet,
Affiliate Products, Affiliates — and two drills held in local state (sales product →
purchasers, coupon → redemptions). These prompts turn every section and drill into a route.

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
- Success            #15803D / #62DF7D   — paid, active, approved, healthy
- Warning            #B45309 / #E6C364   — unpaid, expiring, pending, needs attention
- Danger             #DC2626 / #FF8A80   — expired, suspended, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, currency amounts, codes, counts, IDs, timestamps: JetBrains Mono.
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
- Every action that messages learners, moves money, or changes their records opens a
  confirmation that names the exact count or amount and states the consequence plainly.

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

## Block 0-SM — Sales & Marketing addendum (paste second)

```text
SALES & MARKETING MODULE ADDENDUM — applies to every screen in /admin/reports/sales-marketing

WHAT THIS MODULE COVERS
Five related but distinct surfaces, in this fixed order, shown as the module tab strip on every
screen: Overview · Sales · Coupons · Referral & wallet · Affiliate products · Affiliates ·
Exports. Sales is revenue per product and who bought. Coupons is discount codes and their
redemptions. Referral & wallet is learner-to-learner referrals and the credit balances they
generate. Affiliate products is which products pay commission. Affiliates is the people earning
it. Never blur these into a single "marketing dashboard" — each has its own table and its own
unit of analysis.

MONEY RENDERING
- All amounts monospace, tabular figures, right-aligned in tables, decimals aligned down the
  column, with the currency code as an 11px Muted Ink suffix: "12,499.00 INR", "349.00 USD".
- Discounts and commission owed render as negatives or liabilities in the appropriate hue:
  a discount is "−1,875.00 INR" in Danger; unpaid commission is Warning; paid is Success.
- Mixed-currency lists never sum into one figure — stack per-currency subtotals with the
  caption "Converted at the rate recorded on the transaction date."
- Wallet credit and referral credit are a separate unit from cash. Always label them
  explicitly: "4,200 credits" in monospace with the caption "wallet credit, not cash", so an
  admin never mistakes a balance for money owed.

ATTRIBUTION IS ALWAYS SHOWN AS A PAIR
Anywhere revenue is attributed to a coupon, referrer, or affiliate, show two figures together:
the gross revenue driven and the cost of driving it (discount given or commission earned), plus
a derived "net to tenant" figure. One number alone is misleading and is banned on these
screens. Example cell cluster: "Revenue 4,18,900.00 INR / Cost 61,240.00 INR / Net
3,57,660.00 INR" with the cost in Warning.

STATUS SETS (real values)
- Coupon status: Active (Success) · Inactive (Warning) · Archived (Muted). Discount type is a
  free-text field in the data — render whatever it holds as a chip, but format the value
  correctly: percentage types as "15%" and amount types as money.
- Affiliate status: Active (Success) · Pending (Warning) · Suspended (Danger) · Inactive
  (Muted). Affiliate tier is a tenant-defined free-text label — render it as a plain chip and
  never assume Bronze/Silver/Gold semantics or colour-code it.
- Affiliate product: Enabled (Success) · Disabled (Muted).

ENROLMENT TYPES (real set, as chips)
Free · Paid · Complimentary · Manual · Offline · Trial.

COHORT ACTIONS
Purchaser lists can become a saved group or receive a message, exactly as in the other report
modules. Both sit behind one "Cohort actions" secondary button opening a drawer, and both
restate the matched count before committing — never bare inline form fields on a table.

DATA REALISM
Products like "Funded Trader Foundations", "Risk Desk Masterclass", "Prop Firm Bootcamp".
Coupon codes in monospace uppercase: "SUMMER15", "LAUNCH2026", "PARTNER-RD". Referral codes
like "priya-r-8f2a". Learner and affiliate names like "Priya Raghunathan", "Tomás Beltrán",
"Ade Okonjo", "Wei-Lin Chua". Amounts like 12,499.00 INR / 349.00 USD. Counts like 47, 218,
1,284. Percentages like 6.4%, 18.2%, 31.7%.
```

---

## Screen 1 — `/admin/reports/sales-marketing` (overview)

```text
Screen: Sales & Marketing — overview. Route /admin/reports/sales-marketing. Desktop 1440px,
admin sidebar with "Reports" expanded and "Sales & Marketing" active.

HEADER
Breadcrumb: Admin / Reports / Sales & Marketing. Title "Sales & Marketing", subtitle "Revenue
by product, coupon performance, referral credit, and affiliate commission." Right side: a
date-range picker reading "1 Jul – 6 Aug 2026", a currency select ("All currencies", "INR",
"USD"), a secondary "Export" button, and a primary "Cohort actions" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Overview · Sales · Coupons · Referral & wallet · Affiliate products · Affiliates · Exports.

REVENUE BAND (unequal cells, first is double width)
"Attributed revenue" — 41,86,200.00 INR in 32px monospace with a delta caption "+14.2% vs
previous 36 days" in Success, and a thin Accent Indigo area chart of daily revenue behind the
lower third. Then: "Discount given 3,84,900.00 INR" in Warning with a caption "9.2% of gross" |
"Commission earned 61,240.00 INR" in Warning with "of which 18,400.00 unpaid" | "Referral
credit issued 84,000 credits" with the caption "wallet credit, not cash" | "Net to tenant
37,40,060.00 INR" in Success.

MAIN GRID — asymmetric 62/38
LEFT COLUMN, two stacked panels:
1. "Where revenue came from" — a single horizontal stacked band across the panel width split
   by acquisition channel (Direct, Coupon, Referral, Affiliate), each segment labelled with its
   amount and share, in graded tints of Accent Indigo with Direct in the full accent. Beneath
   the band, an inline legend row and a caption "Coupon and affiliate revenue overlap where a
   coupon is an affiliate's code — overlap is counted once, to affiliate." Then a stacked bar
   chart of the same split per week over the range.
2. "Top products" — a table of 6 rows: Product (title over a product-type chip) | Purchasers |
   Revenue | Discount given | Net | a mini bar of revenue share. The leader gets an Accent Wash
   row tint.
RIGHT COLUMN, three stacked panels:
1. "Best-performing coupons" — 5 rows: code in monospace uppercase, redemptions, revenue
   driven, discount cost, and a thin two-segment bar showing net versus cost.
2. "Top affiliates" — 5 rows: affiliate name over email, tier chip, revenue contributed,
   commission earned, and unpaid amount in Warning where non-zero.
3. "Needs attention" — an action list: "18,400.00 INR commission unpaid across 6 affiliates",
   "3 coupons expire in the next 14 days", "2 affiliates pending approval", "1 affiliate
   product disabled but still receiving traffic"; each row with a chevron linking to a filtered
   view.

ALSO PRODUCE as separate frames:
A. Loading — skeleton band, chart placeholder blocks, skeleton rows.
B. Empty — line-art tag-and-arrow mark, "No sales or marketing activity in this range", a
   primary "Reset date range".
C. Error — inline Danger strip "Couldn't load sales and marketing data." with Retry.
D. Mobile 390px — revenue band as a two-up grid, charts full width, tab strip horizontally
   scrollable, side panels stacked beneath.
```

---

## Screen 2 — `/admin/reports/sales-marketing/sales`

```text
Screen: Sales by product. Route /admin/reports/sales-marketing/sales. Module tab active on
"Sales".

HEADER
Title "Sales", subtitle "Revenue, paid and trial learners, and purchaser counts for every
product." Right: date-range picker, secondary "Export CSV", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Revenue 41,86,200.00 INR" at 32px monospace with a delta caption
(double width) | "Purchasers 1,284" | "Paid learners 1,196" | "Trial learners 218" in Warning
with the caption "not yet converted" | "Average order 3,262.00 INR".

FILTER BAR
Search input ("Search product title"), "Product type" select (Course, Bundle, Subscription,
Test series, Live class), "Category" combobox, "Instructor" combobox, "Currency" select,
"Revenue between" dual numeric inputs, and a "Sort" select (Revenue ↓, Purchasers ↓, Trial
learners ↓, Title A–Z). Applied-filter chips beneath with "Clear all" and "Save as view".

TABLE — one product per row
[checkbox] | Product (title in Accent Indigo over a product-type chip) | Revenue (monospace
right-aligned with a 3px inline bar scaled against the top product) | Purchasers (monospace) |
Paid learners (monospace) | Trial learners (monospace, Warning tint where trials exceed paid) |
Conversion (paid ÷ (paid + trial) as a percentage with a bar) | Average order (monospace) |
Currency | chevron. Rows click through to the purchaser list. Sortable on Revenue, Purchasers,
Trial learners; active sort = Revenue descending. Show 10 rows including one product with
trials but no paid conversions, rendered with a Warning left rail.

FOOTER: per-currency page and filtered revenue totals, "Showing 1–25 of 42 products",
page-size select, paginator.

SELECTION BAR: "3 products selected · 486 purchasers" with "Message purchasers", "Create
group", "Export selection", "Clear".

ALSO PRODUCE: loading skeleton; empty state — line-art price-tag mark, "No products with sales
in this range"; inline error strip; and a 390px mobile frame where each product is a card with
the revenue bar full width.
```

---

## Screen 3 — `/admin/reports/sales-marketing/sales/[courseId]`

```text
Screen: Purchasers for a product. Route /admin/reports/sales-marketing/sales/[courseId]. Back
text-link "All products".

HEADER
Breadcrumb: Admin / Reports / Sales & Marketing / Sales / Funded Trader Foundations. Title: the
product title with a product-type chip and a "Published" pill. Right: secondary "Columns",
secondary "Export CSV", secondary "Open product", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Revenue 8,42,300.00 INR" at 32px monospace with a delta caption
(double width) | "Purchasers 268" | "Paid 241" | "Trial 27" in Warning | "Average order
3,143.00 INR" | "Discounted orders 84" with the caption "31.3% used a coupon".

REVENUE STRIP — a slim full-width panel: a bar chart of revenue per day across the range with a
thin line overlay for purchaser count on a secondary axis, an inline legend above, and a
caption naming the best day.

FILTER BAR
Learner name search, email search, "Purchased from" date, "Purchased to" date, "Enrolment type"
select (All, Free, Paid, Complimentary, Manual, Offline, Trial), "Amount between" dual numeric
inputs, "Used a coupon" toggle, and a sort select (Purchased on ↓, Amount ↓, Learner A–Z).
Chips beneath with "Clear all" and "Save as view".

COLUMNS POPOVER — produce one frame with it open listing the real column set: Learner, Email,
Amount, Currency, Type, Purchased on — with checkboxes, drag handles, "Reset to default",
Apply.

TABLE
[checkbox] | Learner (avatar chip + name over email, name links to the member profile) |
Amount (monospace right-aligned; where a coupon applied, the pre-discount amount appears above
as struck-through Muted Ink with the discount in Danger beneath) | Currency | Enrolment type
chip | Coupon (the code in monospace uppercase as a link, or an em dash) | Order (the payment
order ID in 11px monospace with a copy icon, linking to the payments transaction detail) |
Purchased on (relative + absolute) | kebab (Open member profile, View transaction, Message
learner, View learner's other purchases). Show 12 rows including three coupon-discounted and
two trial rows.

SELECTION BAR: "9 purchasers selected · 28,290.00 INR" with "Message purchasers", "Create
group", "Export selection", "Clear".

COHORT ACTIONS DRAWER (produce as its own frame): header restating "268 purchasers match the
current filters" in 20px monospace with a "View matched learners" link and the active filters
as chips. Two segmented modes — "Create group" (name field pre-filled "Purchasers — Funded
Trader Foundations", optional description, a static/live sync radio, footer primary "Create
group with 268 learners") and "Send message" (subject, rich-text body with a merge-tag chip row
for learner name, product title, purchase date, amount; an "Exclude learners messaged in the
last 7 days" checkbox that live-updates the count; channel checkboxes; send-now or schedule
radio; "Send a test to myself"; footer primary "Send to 241 learners"). Both behind a
confirmation restating the count.

FOOTER: per-currency totals, count line, page-size select, paginator.

ALSO PRODUCE: loading skeleton; empty state "No purchasers matched these filters"; error strip;
mobile 390px card list.
```

---

## Screen 4 — `/admin/reports/sales-marketing/coupons`

```text
Screen: Coupons. Route /admin/reports/sales-marketing/coupons. Module tab active on "Coupons".

HEADER
Title "Coupons", subtitle "Discount codes, what they cost, and what they brought in." Right:
date-range picker, secondary "Export CSV", secondary "Manage coupons" linking to the coupon
editor, primary "Cohort actions".

SUMMARY BAND (unequal cells): "Revenue driven 12,84,600.00 INR" at 32px monospace with a bar
(double width) | "Discount given 3,84,900.00 INR" in Warning with the caption "23.1% of gross"
| "Net to tenant 8,99,700.00 INR" in Success | "Redemptions 418" with "3.4 per active coupon" |
"Expiring in 14 days 3" in Warning, clickable to filter.

FILTER BAR
Search ("Search code or name"), "Status" select (Active, Inactive, Archived, All), "Discount
type" select (Percentage, Fixed amount, All), "Product" combobox, "Redemptions" select (Any,
Never used, 1–10, More than 10), "Created" date range, and a Sort select (Revenue ↓,
Redemptions ↓, Discount cost ↓, Created ↓). Chips beneath with "Clear all" and "Save as view".
Saved-view tabs: "All coupons" (active), "Active", "Never used", "Expiring soon", "Archived",
"+ New view".

TABLE — one coupon per row
[checkbox] | Code (monospace uppercase in Accent Indigo, with a copy icon, and the coupon name
beneath in Muted Ink) | Status pill | Discount (a chip carrying the type and the formatted
value — "15%" for percentage types, "500.00 INR" for amount types) | Redemptions (monospace,
with the usage cap beneath as "84 of 200" and a 3px bar where a cap exists) | Revenue driven
(monospace with a bar) | Discount cost (monospace in Warning) | Net (monospace in Success) |
Created | chevron. Rows click through to the redemption list. Sortable on Redemptions, Revenue
driven, Discount cost; active sort = Revenue driven descending. Show 10 rows including one
never-used coupon at reduced emphasis with a "0 redemptions" caption, one at its usage cap with
a full bar and a Warning "Cap reached" pill, and one archived.

FOOTER: per-currency totals for revenue, cost, and net; count line; page-size select;
paginator; and a Muted Ink caption: "Revenue driven counts the full order value of any order
where the coupon applied."

SELECTION BAR: "4 coupons selected" with "Export selection", "Archive", "Clear".

ALSO PRODUCE: loading skeleton; empty state — line-art coupon mark, "No coupons match these
filters", sentence "Coupons are created in Marketing → Coupons.", primary "Manage coupons";
inline error strip; and a 390px mobile frame where each coupon is a card with the code as the
heading and revenue/cost/net as a three-row stack.
```

---

## Screen 5 — `/admin/reports/sales-marketing/coupons/[couponId]`

```text
Screen: Coupon redemptions. Route /admin/reports/sales-marketing/coupons/[couponId]. Back
text-link "All coupons".

HEADER
Breadcrumb down to the coupon. Title: the coupon code at 24px/600 in monospace uppercase with a
copy button, the coupon name beneath in Muted Ink, and a chip cluster: status, discount type
and value, "84 of 200 used", "Expires 30 Sep 2026". Right: secondary "Export CSV", secondary
"Open in coupon editor", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Revenue driven 2,64,300.00 INR" at 32px monospace with a bar
(double width) | "Discount given 39,645.00 INR" in Warning | "Net 2,24,655.00 INR" in Success |
"Redemptions 84" with "of 200 cap" and a bar | "Average order 3,146.00 INR" | "First-time
buyers 61" with the caption "72.6% of redemptions".

TWO PANELS side by side, asymmetric 58/42:
LEFT: "Redemptions over time" — a bar chart of redemptions per day across the coupon's life,
Accent Indigo, with a thin line overlay for revenue, an inline legend, and markers for the
coupon's start and expiry dates. A caption names the peak day.
RIGHT: "Where it was redeemed" — a ranked list of products: product title, redemptions,
revenue, discount given, each with a mini bar. Beneath it a small "Redeemed by" split showing
first-time versus returning buyers as a two-segment band with counts.

FILTER BAR
Learner name search, "Product" combobox, "Applied from" date, "Applied to" date, "Amount
between" dual numeric inputs, and a sort select (Applied on ↓, Discount ↓, Final amount ↓).
Chips beneath with "Clear all".

TABLE
[checkbox] | Learner (avatar chip + name over email) | Product (title over a product-type chip)
| Discount (monospace in Danger with a leading minus) | Final amount (monospace right-aligned)
| Currency | Order (payment order ID in 11px monospace linking to the transaction detail) |
Applied on (relative + absolute) | kebab (Open member profile, View transaction, Message
learner). Show 12 rows across several products.

SELECTION BAR: "6 redemptions selected · 18,876.00 INR" with "Message learners", "Create
group", "Export selection", "Clear".

FOOTER: per-currency totals for discount and final amount, count line, page-size select,
paginator.

ALSO PRODUCE: loading skeleton; the never-redeemed empty state — "This coupon has not been
redeemed yet", a sentence naming its creation date and cap, and a secondary "Open in coupon
editor"; inline error strip; and a 390px mobile frame.
```

---

## Screen 6 — `/admin/reports/sales-marketing/referral-wallet`

```text
Screen: Referral & wallet. Route /admin/reports/sales-marketing/referral-wallet. Module tab
active on "Referral & wallet".

HEADER
Title "Referral & wallet", subtitle "Learners who refer others, the credit they have earned,
and their current balances." Right: date-range picker, secondary "Export CSV", secondary
"Referral settings", primary "Cohort actions".

SUMMARY BAND (unequal cells): "Successful referrals 418" at 32px monospace with a delta caption
(double width) | "Credit earned 84,000 credits" with the caption "wallet credit, not cash" |
"Credit outstanding 31,200 credits" in Warning with "held in 214 wallets" | "Referred revenue
6,42,900.00 INR" | "Referrers with at least one 214 of 3,412 learners".

TWO PANELS side by side, asymmetric 60/40:
LEFT: "Referrals over time" — a bar chart of successful referrals per week with a thin line for
referred revenue on a secondary axis, inline legend, caption naming the best week.
RIGHT: "Referrer concentration" — a horizontal band showing what share of referrals comes from
the top 1, top 10, and the rest, each labelled, with a caption "The top 10 referrers drove
38.2% of all referrals." Beneath it a small distribution: how many learners made exactly 1, 2,
3–5, and 6+ referrals, as labelled mini bars.

FILTER BAR
Search ("Search learner name, email, or referral code"), "Signed up from" date, "Signed up to"
date, "Referrals" select (Any, At least 1, At least 5, At least 10), "Wallet balance" select
(Any, Zero, Has balance, Above 5,000 credits), and a sort select (Referrals ↓, Credit earned ↓,
Wallet balance ↓, Signed up ↓). Chips beneath with "Clear all".

TABLE
[checkbox] | Learner (avatar chip + name over email) | Referral code (monospace with a copy
icon, or "No code" in Muted Ink) | Successful referrals (monospace with a 3px bar scaled
against the top referrer) | Credit earned (monospace with the "credits" unit suffix) | Wallet
balance (monospace; Warning tint where a large balance is outstanding) | Credit spent (derived,
monospace, with the caption "earned minus balance") | Signed up on (relative + absolute) |
kebab (Open member profile, View referred learners, Adjust wallet balance, Message learner).
Sortable on referrals, credit earned, wallet balance; active sort = Referrals descending. Show
12 rows including several learners with a code but zero referrals and one top referrer with an
Accent Wash row tint.

SELECTION BAR: "5 learners selected" with "Message learners", "Create group", "Export
selection", "Clear".

DRILL DRAWER — "Referred learners" (produce as its own frame): opened from a row, showing the
referrer at the top, then a table of learners they referred: Learner (avatar chip + name over
email) | Signed up on | First purchase (product title and amount, or "No purchase yet" in
Muted Ink) | Revenue attributed (monospace) | Credit awarded (monospace with the credits
suffix) | Status pill (Qualified / Pending / Disqualified). A footer summary restates the
referrer's totals.

ALSO PRODUCE: loading skeleton; empty state "No referrals recorded in this range"; error strip;
and a 390px mobile frame where each learner is a card with referrals, credit earned, and
balance as a three-row stack.
```

---

## Screen 7 — `/admin/reports/sales-marketing/affiliate-products`

```text
Screen: Affiliate products. Route /admin/reports/sales-marketing/affiliate-products. Module tab
active on "Affiliate products".

HEADER
Title "Affiliate products", subtitle "Which products pay commission, and what that programme
has returned." Right: date-range picker, secondary "Export CSV", secondary "Affiliate
settings", primary "Enable a product".

SUMMARY BAND (unequal cells): "Affiliate revenue 4,18,900.00 INR" at 32px monospace with a bar
(double width) | "Commission earned 61,240.00 INR" in Warning with the caption "14.6% effective
rate" | "Net to tenant 3,57,660.00 INR" in Success | "Orders 218" with "1,921.00 INR average" |
"Products enabled 12 of 42".

FILTER BAR
Search ("Search product title"), "Programme" select (All, Enabled, Disabled), "Product type"
select, "Category" combobox, "Commission rate" select (Any, Below 10%, 10–20%, Above 20%), and
a sort select (Revenue ↓, Commission ↓, Orders ↓, Title A–Z). Chips beneath with "Clear all".

TABLE — one product per row
[checkbox] | Product (title in Accent Indigo over a product-type chip) | Programme (a toggle
rendered inline showing Enabled or Disabled, with the change requiring the confirmation modal
below — never a silent toggle) | Commission rate (monospace percentage or fixed amount, with
the caption "tenant default" where inherited) | Orders (monospace) | Revenue (monospace with a
3px bar) | Commission (monospace in Warning) | Net (monospace in Success) | Effective rate
(commission ÷ revenue as a percentage) | Published on | chevron to the product's affiliate
detail. Sortable on Revenue, Commission, Orders. Show 10 rows including two disabled products
at reduced emphasis — one of them with a Warning caption "Disabled, but 4 affiliate links are
still active" and a "View links" text button.

FOOTER: per-currency totals for revenue, commission, and net; count line; page-size select;
paginator.

MODAL — "Disable affiliate programme for this product": names the product, states how many
affiliates currently promote it and how much commission is unpaid on it, warns "Existing
affiliate links will stop earning commission on new orders. Unpaid commission already earned is
not affected.", requires a reason select, then Cancel and a solid Danger "Disable programme".
Also produce the enable variant, which asks for the commission rate (inherit tenant default or
override) and a start date, then a primary "Enable programme".

ALSO PRODUCE: loading skeleton; empty state "No products are enabled for affiliates" with a
line-art link mark and a primary "Enable a product"; error strip; mobile 390px card list.
```

---

## Screen 8 — `/admin/reports/sales-marketing/affiliates`

```text
Screen: Affiliates. Route /admin/reports/sales-marketing/affiliates. Module tab active on
"Affiliates".

HEADER
Title "Affiliates", subtitle "People promoting your products, what they have earned, and what
is owed." Right: date-range picker, secondary "Export CSV", secondary "Affiliate settings",
primary "Record payout".

SUMMARY BAND (unequal cells): "Revenue contributed 4,18,900.00 INR" at 32px monospace with a
bar (double width) | "Commission earned 61,240.00 INR" | "Unpaid 18,400.00 INR" in Warning with
the caption "across 6 affiliates", clickable to filter | "Paid 42,840.00 INR" in Success |
"Active affiliates 34 of 41" | "Pending approval 2" in Warning, clickable.

FILTER BAR
Search ("Search name, email, or coupon code"), "Status" select (Active, Pending, Suspended,
Inactive, All), "Tier" combobox (populated from the tenant's own tier labels), "Unpaid" select
(Any, Has unpaid commission, Above 5,000, Nothing owed), "Signed up" date range, and a sort
select (Revenue ↓, Commission ↓, Unpaid ↓, Signed up ↓). Chips beneath with "Clear all" and
"Save as view". Saved-view tabs: "All affiliates" (active), "Owed commission", "Pending
approval", "Top earners", "Suspended", "+ New view".

TABLE — one affiliate per row
[checkbox] | Affiliate (avatar chip + name over email) | Tier chip (plain, uncoloured) | Status
pill | Coupon code (monospace uppercase with a copy icon, linking to the coupon's redemption
list) | Revenue contributed (monospace with a 3px bar scaled against the top affiliate) |
Commission earned (monospace) | Unpaid (monospace in Warning where non-zero, an em dash where
settled) | Paid (monospace in Success) | Signed up on | kebab (View affiliate detail, Record
payout, View their coupon, Approve, Suspend, Open member profile). Sortable on Revenue,
Commission, Unpaid; active sort = Revenue descending. Show 12 rows spanning every status,
including two pending-approval rows with a Warning rail and inline "Approve" / "Decline" text
buttons, and one suspended row at reduced emphasis.

SELECTION BAR: "4 affiliates selected · 11,200.00 INR unpaid" with "Record payout", "Message
affiliates", "Export selection", "Clear".

FOOTER: per-currency totals for revenue, commission, unpaid, and paid; count line; page-size
select; paginator.

DETAIL DRAWER — produce one frame with an affiliate expanded: header with avatar, name, email,
tier chip, status pill, and their coupon code in monospace. Then a metric row (revenue,
commission, unpaid, paid). Then three stacked sections — "Earnings over time" (a bar chart of
commission per month with a thin revenue line); "Attributed orders" (a compact table: order ID
in monospace linking to the transaction, learner, product, order amount, commission, date);
"Payout history" (payout reference in monospace, period covered, amount, method, paid on,
status pill). Sticky footer: secondary "Message affiliate", secondary "View their coupon",
primary "Record payout".

MODAL — "Record payout": restates the affiliate name and the exact unpaid amount and currency;
a payout-amount field pre-filled with the full unpaid balance and capped at it, with a "Partial
payout" caption when reduced; a method select (Bank transfer / UPI / PayPal / Wallet credit /
Manual adjustment); a reference field; a paid-on date defaulting to today; a "Notify the
affiliate by email" checkbox checked by default; an irreversible caption "Recording a payout
marks this commission as settled and cannot be undone from this console."; then Cancel and a
primary "Record 4,200.00 INR". Plus a busy variant.

ALSO PRODUCE: the "Suspend affiliate" modal (states that their coupon stops earning commission
immediately, that unpaid commission remains payable, requires a reason, solid Danger confirm);
loading skeleton; empty state "No affiliates match these filters"; error strip; and a 390px
mobile frame where each affiliate is a card with revenue/commission/unpaid stacked and the
drawer becomes a full-screen sheet.
```

---

## Screen 9 — `/admin/reports/sales-marketing/exports`

```text
Screen: Sales & Marketing exports. Route /admin/reports/sales-marketing/exports. Module tab
active on "Exports".

HEADER
Title "Exports", subtitle "Download sales, coupon, referral, and affiliate data, or schedule
recurring delivery." Primary "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Sales by product / Purchasers / Coupons / Coupon redemptions / Referral & wallet
/ Affiliate products / Affiliates / Affiliate payouts) | Scope (a filter summary, e.g.
"Funded Trader Foundations · 1 Jul – 6 Aug 2026") | Rows | Size | Requested by | Created
(relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) | action
(Download, or Retry on failure). Show 7 rows covering every status; the Building row carries a
thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files are deleted
after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Monthly affiliate commission statement"),
dataset chip, cadence line ("On the 1st of each month, 06:00 Asia/Kolkata"), recipient chips
(finance email plus an accounting webhook), format chip, "Next run in 25 days", an enabled
toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two schedules, one disabled at reduced
emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented across the eight datasets above, wrapping to two
rows). Scope (dataset-dependent: a product combobox for purchasers, a coupon combobox for
redemptions, an affiliate multi-select for affiliate datasets, plus a date-range picker for
all). Columns (a two-column checkbox list matching the real sets — purchasers: learner, email,
amount, currency, type, purchased on; with "Select all" and a Warning caption beside email
reading "Contains learner personal data", and a second Warning beside payout fields reading
"Contains financial settlement data"). Filters (a read-only summary of the currently applied
report filters with a "Use current filters" toggle, on). Grouping (optional select: none / by
product / by coupon / by affiliate / by month, with an "Include per-group subtotals" checkbox).
Format (segmented CSV / XLSX / JSON). Delivery (radio: Download now / Email me when ready /
Send to recipients, revealing an email chips input and an optional webhook URL). A "Schedule
this export" toggle revealing cadence, time, and timezone. Footer: Cancel and a primary
"Create export".

ALSO PRODUCE: a ready toast "affiliates-commission-2026-08-06.csv is ready" with a Download
action; a failed-export popover showing the error reason and Retry; and a mobile frame where
schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature | Status |
| --- | --- |
| Sales by product: revenue, paid/trial learner counts, purchaser count | exists |
| Purchaser list per product with name/email/date filters, sort, column picker | exists |
| Coupon list: code, name, status, discount type and value, redemptions, total discount, total revenue | exists |
| Coupon redemption list with learner, product, discount, final amount, applied-at | exists |
| Referral & wallet list: referral code, successful referrals, credit earned, wallet balance | exists |
| Affiliate products: enabled flag, order count, revenue, commission, published-at | exists |
| Affiliates: tier, status, coupon code, revenue contribution, commission earned, unpaid, paid | exists |
| Async CSV export; message matched purchasers; create group from purchasers | exists |
| Overview channel attribution, revenue trend charts, "needs attention" | needs backend aggregates |
| Conversion rate, average order, discounted-order share, first-time-buyer split | derivable in places, but not returned today |
| Coupon usage caps and expiry dates | not in the report DTO — check the coupon domain before rendering caps |
| Referred-learner drill (who a referrer brought in, per-referral status and credit) | needs backend |
| Wallet adjustments | needs backend |
| Affiliate detail: attributed orders, earnings over time, payout history | needs backend |
| Record payout, approve/decline, suspend affiliate | needs backend — this module is read-only today |
| Enable/disable an affiliate product, commission-rate overrides | needs backend |
| Saved views, export history, scheduled exports | export runs exist; history UI and scheduling need backend |
| Multi-currency subtotals / conversion | currency is stored per row; conversion rates need backend |

Two data-shape notes worth checking before build: `discount_type` and affiliate `tier` are both
free-text `String` columns, not enums — so the UI must format on the value rather than assume a
fixed set, and tier must not be colour-coded.
