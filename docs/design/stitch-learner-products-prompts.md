# Google Stitch Prompts — Learner Products (`/admin/manage/learner-products`)

Paste **Block 0 (Design System)** first, then **Block 0-LP (Learner Products addendum)**, then
one screen prompt per generation.

Block 0 is the **admin** design system, identical to the one in the report-module files — not the
learner Block 0-L used for `/notifications`. Reproduced below so this file stands alone.

**Note on the route.** The screen is registered as a section slug inside the admin Manage area,
so its real path is `/admin/manage/learner-products`, rendered by `AdminManageSectionPage`. The
subscreen routes below extend that path.

Source of truth:

- `frontend/apps/web/src/features/admin/learner-products/AdminLearnerProductsPage.tsx`
- `frontend/apps/web/src/features/admin/learner-products/learner-products-api.ts`
- `frontend/apps/web/src/features/admin/manage/admin-manage-catalog.ts`
- `backend/packages/domain/src/learner-products/learner-products.dto.ts`
  (`PUBLISH_STATUSES`, `BILLING_INTERVALS`, `BUNDLE_ITEM_KINDS`, `SUBSCRIPTION_ITEM_KINDS`)
- `backend/apps/api/src/app/api/v1/{mock-tests,test-series,bundles,learner-subscription-plans}/*`

**What this screen is, in one line from the code itself.** The API client's own docstring says
these four product types "shipped with full backend support — list, create and enrol — and no UI
at all, so a tenant could not see what was in its own catalogue, let alone put a learner into
one." That is the job: make the catalogue visible and let an admin place someone into a product.

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
- Success            #15803D / #62DF7D   — published, active, healthy
- Warning            #B45309 / #E6C364   — draft, incomplete, needs attention
- Danger             #DC2626 / #FF8A80   — archived, failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, slugs, IDs, counts, timestamps: JetBrains Mono.
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
- Every action that grants a learner access or changes what they can see opens a confirmation
  that names the exact learner and product and states the consequence in plain words.

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

## Block 0-LP — Learner Products addendum (paste second)

```text
LEARNER PRODUCTS MODULE ADDENDUM — applies to every screen under
/admin/manage/learner-products

WHAT THIS MODULE IS
The tenant's catalogue of the four sellable learner products that are not plain courses — mock
tests, test series, bundles, and subscription plans — plus the ability to place a learner into
one. Courses have their own admin area; this module never lists or edits a course, only
references one as an item inside a bundle or a plan.

ENROLMENT HERE IS PLACEMENT, NOT PURCHASE — AND THE COPY MUST SAY SO
The enrol action is the admin-side enrollment.manage capability: an administrator putting
somebody into a product without a payment. It is not learner self-service checkout, there is no
price anywhere in this module, and no money changes hands. So:
  - never render a price, a currency, a discount, or a "Buy" affordance on any screen here;
  - label the action "Enrol a learner", never "Purchase", "Grant access", or "Add to cart";
  - every enrol confirmation states plainly: "This places the learner into the product
    immediately. No payment is taken and no invoice is created."
If an admin wants the paid path, that is the learner storefront and the payments module — link
out rather than reproducing it.

THE FOUR PRODUCT TYPES SHARE ONE SCREEN BUT ARE GENUINELY DIFFERENT SHAPES
Tabs, in exactly this order: Mock tests · Test series · Bundles · Subscription plans.
  - A mock test wraps a single assessment. It has no contents list at all — only an assessment
    reference. Its "Contents" cell is an em dash, and that em dash is correct, not missing data.
    Never invent a contents count for it.
  - A test series holds an ordered list of tests. Its contents read "N tests".
  - A bundle holds an ordered list whose items may be a course, a mock test, or a test series.
    Its contents read "N items", and the mix of kinds is the interesting part.
  - A subscription plan holds an ordered list whose items may be a course, a mock test, a test
    series, or a bundle, and additionally carries a billing interval. Its contents read
    "monthly · N items".
Because the four differ, never force a shared column to look uniform by padding it with zeros or
placeholder text. Let the em dash stand.

STATUS IS DRAFT / PUBLISHED / ARCHIVED — NOT THE USUAL ADMIN TRIPLE
Most admin modules in this console use Active / Inactive / Archived. Learner products do not:
their real enum is DRAFT, PUBLISHED, ARCHIVED. Render them sentence-case as pills — Draft in
Warning, Published in Success, Archived in Muted — and never show "Active" or "Inactive"
anywhere in this module, because those values cannot occur.
A draft product can still be enrolled into by an admin. Say that in a caption rather than
disabling the action, because the API permits it and an admin placing a pilot learner into an
unpublished product is a real workflow.

ITEMS ARE REFERENCES, NOT RESOLVED TITLES
A test series, bundle, or plan carries its items as an id, an item kind, and a position — the
list endpoint does not return the referenced titles. So on the catalogue screen show only the
count. Anywhere a design wants to name the items, it must be on a screen that fetches them, and
where a title cannot be resolved, show the id in monospace with a Muted caption "Title not
loaded" rather than a blank row or a guessed name.
Item kinds are fixed: a bundle may contain course, mock_test, or test_series; a plan may contain
course, mock_test, test_series, or bundle. Render each kind as a plain Muted chip with the words
spelled out — "Course", "Mock test", "Test series", "Bundle" — and never offer a kind that the
type does not allow.

BILLING INTERVAL IS THREE VALUES AND IT IS NOT A PRICE
monthly · yearly · custom. It describes the cadence a plan is sold on, nothing more. Render it
as a plain chip. "Custom" carries a Muted caption noting that the cadence is defined outside
this module. Never pair it with an amount, because no amount exists here.

ENROLLED TYPE IS FREE TEXT, SO DO NOT DRAW A FIXED DROPDOWN
The enrol body takes an enrolledType string of up to 64 characters, defaulting to "free". It is
not an enum. Render it as a text input with a datalist of common values offered as suggestions —
free, paid, complimentary, manual, offline, trial — while still accepting anything the admin
types. A locked select would be a lie about the contract.

THERE IS NO WAY TO LIST WHO IS ENROLLED — DESIGN AROUND THAT HONESTLY
The API exposes POST to enrol and nothing else: no enrolment list, no count, no removal. So the
catalogue table must not carry an "Enrolled" column or a learner count, and no screen may show a
roster it cannot fetch. Where a design needs that view, mark it plainly as depending on an
endpoint that does not exist yet rather than mocking it as if it worked.

SLUGS ARE IDENTITY — RENDER THEM IN MONOSPACE
Every product carries a human title and a URL slug. Show the title as the primary label and the
slug beneath it in 11px monospace with a copy icon, because the slug is what appears in links,
support tickets, and API calls.

PAGINATION IS REAL AND SHOULD BE SHOWN
The list endpoints return page, pageSize, totalCount, and totalPages, with the page size fixed
at 25. So a footer showing "Showing 1–25 of 68" plus a paginator is accurate and should be drawn
— unlike the cursor-paginated screens elsewhere in this product, where no total exists.

DATA REALISM
Titles like "Foundations final mock", "Risk desk mock 02", "Prop firm readiness series",
"Complete trader bundle", "Academy all-access". Slugs in monospace kebab-case:
"foundations-final-mock", "prop-firm-readiness-series". Counts like 4 tests, 7 items. Learner
names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo". Membership IDs as UUID fragments
in monospace.
```

---

## Screen 1 — `/admin/manage/learner-products` (the catalogue)

```text
Screen: Learner Products — catalogue. Route /admin/manage/learner-products. Desktop 1440px,
admin sidebar with "Manage" expanded and "Learner Products" active.

HEADER
Breadcrumb: Admin / Manage / Learner Products. Title "Learner Products", subtitle "Mock tests,
test series, bundles and subscription plans, and who is enrolled in them." Right side: a
secondary "Export CSV" button and a primary "New product" button with a caret that opens a menu
of the four types.

MANAGE SECTION TAB STRIP — the Manage area's own nav, above the page content, horizontally
scrollable: Course Encryption · Discussions · Ratings and Reviews · Answer reviews · Learner
Support · Archive Learners · Course Backup · Learner Products · Tags, with "Learner Products"
active in Accent Indigo.

PLACEMENT NOTE — a slim Sunken Surface strip directly beneath the page header, one line in Muted
Ink: "Enrolling here places a learner into a product directly. No payment is taken and no
invoice is created." Not dismissible; it is the framing for every action on the screen.

PRODUCT TYPE TABS — a segmented control, four options in this exact order: Mock tests · Test
series · Bundles · Subscription plans, with "Mock tests" selected. Beneath it a caption naming
the scope of the active tab: "24 mock tests in this catalogue".

FILTER BAR — a Sunken Surface strip: a search input labelled "Search" with the placeholder
"Title or slug" and a caption noting search applies on submit rather than per keystroke; a
"Status" select (All, Draft, Published, Archived); and — only on the Subscription plans tab — a
"Billing interval" select (All, Monthly, Yearly, Custom). Applied filters render as removable
chips beneath with "Clear all".

TABLE — one product per row, columns matching the real ones:
[checkbox] | Title (in Accent Indigo, with the slug beneath in 11px monospace and a copy icon) |
Contents (per the addendum's per-type rule — an em dash for mock tests, "4 tests" for a series,
"7 items" for a bundle, "monthly · 5 items" for a plan) | Status pill (Draft / Published /
Archived) | Updated (relative + absolute in monospace) | Actions (a primary-weight "Enrol a
learner" text button plus a kebab: Open product, Edit contents, Publish, Archive, Copy slug,
Copy product ID).
Rows click through to the product detail. Sortable headers on Title and Updated; active sort =
Updated descending. Show 10 rows on the Mock tests tab, every Contents cell an em dash, with a
Muted Ink caption beneath the table reading "Mock tests wrap a single assessment and have no
contents list." Mix statuses across the rows including two drafts and one archived at reduced
emphasis.

FOOTER: "Showing 1–25 of 68 mock tests" on the left, the page-size shown as a static "25 per
page" caption rather than a control (the API fixes it), and a paginator on the right.

SELECTION BAR (render visible): "3 products selected" with "Publish", "Archive", "Export
selection", "Clear".

ALSO PRODUCE as separate frames:
A. The Bundles tab — the same layout with the Contents column populated ("7 items"), and one row
   expanded inline to reveal its item kinds as a chip row (Course, Course, Mock test, Test
   series) with a caption "Item titles load on the product page."
B. The Subscription plans tab — Contents cells reading "monthly · 5 items", "yearly · 12 items",
   "custom · 3 items", with the billing-interval filter present in the filter bar and the custom
   row carrying its Muted caption.
C. Loading — skeleton rows matching exact column widths, the tabs and filter bar live.
D. Empty catalogue — line-art mark of stacked cards, heading "Nothing in this catalogue yet",
   the sentence "Mock tests, test series, bundles and plans you create will appear here.", and a
   primary "New mock test" button matching the active tab.
E. Empty search — "No mock tests match “readiness”" with a "Clear search" button, the tabs and
   filter bar retained.
F. Error — an inline Danger strip reading "Couldn't load the catalogue." with Retry.
G. Mobile 390px — the type tabs scroll horizontally, each product becomes a card with title,
   slug, contents, status pill, and a full-width "Enrol a learner" button.
```

---

## Screen 2 — `/admin/manage/learner-products/[type]/[productId]`

```text
Screen: Product detail. Route /admin/manage/learner-products/[type]/[productId]. Back text-link
"All learner products". Produce two variants: a bundle (the richest shape) and a mock test (the
sparsest), so the difference between the types is proven rather than assumed.

HEADER
Breadcrumb: Admin / Manage / Learner Products / Complete trader bundle. Title: the product
title, with the slug beneath in monospace with a copy icon, and a chip cluster: the type
("Bundle"), the status pill, and — for a plan only — the billing interval. Right: secondary
"Edit contents", secondary "Duplicate", a status action that reads "Publish" for a draft and
"Archive" for a published product, and a primary "Enrol a learner".

PLACEMENT NOTE — the same Sunken Surface strip from the catalogue, carried through.

SUMMARY BAND (unequal cells, first double width): "Contents 7 items" at 32px monospace with a
caption breaking down the kinds — "4 courses · 2 mock tests · 1 test series" | "Status Draft"
with the caption "Admins can still enrol into a draft" | "Created 14 Mar 2026" | "Updated 2 days
ago" | "Product ID" showing an 8-character monospace fragment with a copy icon.

DESCRIPTION PANEL — the product's description rendered as plain prose in a Panel Surface block,
with an "Edit" text button top-right. Where the description is null, the panel shows a single
Muted Ink line "No description set" and the same Edit button — never a blank card.

CONTENTS PANEL — the main object on the bundle variant: an ordered list, one row per item, each
showing its position as a monospace ordinal, the item kind as a Muted chip, the resolved title in
Accent Indigo where available, and the reference ID in 11px monospace with a copy icon. Rows
whose title could not be resolved show the ID as the primary value with a Muted caption "Title
not loaded" — and one row in the mockup must be in that state, because the list endpoint returns
references only. A footer line reads "7 items · ordered as shown to the learner" and an "Edit
contents" secondary button sits top-right of the panel.

MOCK TEST VARIANT — the contents panel is replaced entirely by an "Assessment" panel: a single
label/value block naming the linked assessment with its ID in monospace, a chevron to open it,
and a Muted Ink caption "A mock test wraps one assessment. It has no contents list." No empty
list, no zero count.

ENROLMENT PANEL — a Panel Surface block that is deliberately honest about its limits: a heading
"Enrolment", a primary "Enrol a learner" button, and beneath it a Sunken Surface line in Muted
Ink reading "This console can place learners into the product but cannot yet list who is already
enrolled." with a chevron link to the enrolments screen. Never render a roster, a count, or a
recent-enrolments list here.

ENROL DRAWER — produce as its own frame, opened from any "Enrol a learner" button: a header
restating the product title, type, and status; a learner field that is a searchable combobox
over members showing avatar, name, and email, with the resolved membership ID displayed in
monospace beneath the selection and a "paste an ID instead" text toggle that swaps it for a
plain UUID input; an "Enrolment type" text input pre-filled with "free", with a suggestion
datalist offering free, paid, complimentary, manual, offline, trial, and a caption stating that
any label up to 64 characters is accepted; an optional "Access expires" date-time picker with the
caption "Leave empty for no expiry"; and a sticky footer with Cancel and a primary "Enrol
learner". A confirmation step restates the learner name, the product title, the enrolment type,
the expiry, and the placement sentence from the addendum before committing. Produce a busy
variant and a failure variant that shows the API error inline with a request ID in monospace.

ALSO PRODUCE: loading skeleton; the archived variant where a Muted strip sits above the summary
band reading "This product is archived and is not offered to learners" while every panel stays
readable; and a 390px mobile frame where the summary band becomes a two-up grid and the contents
list becomes stacked cards.
```

---

## Screen 3 — `/admin/manage/learner-products/[type]/new`

```text
Screen: New product. Route /admin/manage/learner-products/[type]/new. A focused full-page form,
single centred column at 840px, the Manage tab strip still visible and a "Cancel" text link
top-right. Produce two variants: a bundle and a subscription plan, since the plan adds billing.

HEADER
Breadcrumb: Admin / Manage / Learner Products / New bundle. Title "New bundle", subtitle "Create
a product learners can be enrolled into." A type segmented control sits directly beneath —
Mock test · Test series · Bundle · Subscription plan — with the current type selected, and a
Muted Ink caption warning that switching type resets the contents section, since the allowed item
kinds differ.

SECTIONS — numbered, stacked, hairline-separated, with a sticky summary rail docked right at
280px above 1200px:
1. BASICS — a "Title" text input; a "Slug" input beneath it that auto-derives from the title in
   monospace with an "Edit slug" toggle and a caption noting the slug appears in links and cannot
   be changed casually later; a "Description" textarea with a character caption.
2. STATUS — a segmented control matching the real enum exactly: Draft · Published · Archived,
   defaulting to Draft, each with a one-line caption beneath — "Not offered to learners yet, but
   admins can still enrol into it", "Offered to learners", "Hidden and not offered". Never show
   Active or Inactive.
3. BILLING — subscription plan variant only: a "Billing interval" segmented control (Monthly ·
   Yearly · Custom) defaulting to Monthly, with a caption under Custom reading "The cadence is
   defined outside this module." No price field anywhere, and a Muted Ink line stating that
   pricing lives in the product's storefront configuration.
4. CONTENTS — the composer, and the section that differs most by type:
   - Mock test: a single "Assessment" searchable combobox with the caption "A mock test wraps one
     assessment", and nothing else.
   - Test series: an ordered list builder that accepts tests only.
   - Bundle: an ordered list builder whose "Add item" control offers exactly three kinds —
     Course, Mock test, Test series — each opening a searchable picker scoped to that kind.
   - Subscription plan: the same builder offering four kinds — Course, Mock test, Test series,
     Bundle.
   Added items render as reorderable rows with a drag handle, a monospace position ordinal, a
   kind chip, the resolved title, and a remove x. A caption beneath states that position
   determines the order the learner sees. An empty builder shows a dashed row reading "No items
   yet — add at least one" with the allowed kinds listed.

STICKY SUMMARY RAIL: type, title, slug in monospace, status, billing interval where relevant,
item count with a per-kind breakdown, and a footer with a primary "Create product" disabled until
title and slug are present, plus a "Save as draft" text button.

ALSO PRODUCE: the mock-test variant where the contents section collapses to the single assessment
picker and the summary rail shows "Assessment" instead of an item count; an inline validation
state where the slug collides with an existing product, showing a Danger caption naming the
conflicting product with a chevron to it; the success state — a centred confirmation panel with
the created product's title, slug, type, and status, and two buttons "Open product" and "Create
another"; and a 390px mobile frame where the summary rail becomes a sticky bottom bar reading
"Bundle · 7 items · Draft".
```

---

## Screen 4 — `/admin/manage/learner-products/[type]/[productId]/contents`

```text
Screen: Edit contents. Route /admin/manage/learner-products/[type]/[productId]/contents. The
ordering and composition surface, split out because reordering deserves room. Not applicable to
mock tests — produce the redirect state for that case.

HEADER
Breadcrumb down to the product, then "Contents". Title "Edit contents", subtitle naming the
product and its type. Right: secondary "Discard changes", primary "Save contents" — disabled
until something changes, with an unsaved-changes caption in Warning when dirty.

LAYOUT — asymmetric 62/38.
LEFT — the ordered list: one row per item with a drag handle on the left edge, a monospace
position ordinal, an item-kind chip, the resolved title in Accent Indigo with the reference ID in
11px monospace beneath, and a remove x. Dragging shows a 2px Accent Indigo insertion line and the
ordinals renumber live behind it. A dashed "Add item" row sits at the end. Items whose title
could not be resolved keep their place in the order and show the ID with the "Title not loaded"
caption — never dropped, never reordered away.
RIGHT — three stacked panels:
1. "Add an item" — a kind segmented control offering only the kinds this product type allows
   (Course, Mock test, Test series for a bundle; those plus Bundle for a plan), then a search
   input and a result list of pickable rows showing title, slug in monospace, and a status pill,
   with already-added items shown at reduced emphasis and an "Added" chip instead of an add
   button.
2. "Composition" — a live breakdown of the pending list by kind as labelled counts with mini
   bars, plus a total, so an admin can see the shape without counting rows.
3. "Rules" — a plain Muted Ink list of the constraints that actually exist: which kinds this type
   allows, that position determines learner-facing order, and that a plan may contain a bundle
   while a bundle may not contain another bundle.

ALSO PRODUCE: the mock-test case — the whole screen replaced by a centred panel reading "A mock
test has no contents list" with a sentence explaining it wraps a single assessment and a primary
"Back to product"; the empty case where the list has no items and the left column shows a dashed
placeholder with the allowed kinds named; a save-confirmation modal that names the product, the
new item count, and states that the order changes what learners see; a loading skeleton; and a
390px mobile frame where the picker becomes a full-screen sheet and reordering uses up and down
controls instead of drag.
```

---

## Screen 5 — `/admin/manage/learner-products/[type]/[productId]/enrollments`

```text
Screen: Enrolments. Route /admin/manage/learner-products/[type]/[productId]/enrollments. This
screen is designed against an endpoint that does not exist yet, and it must say so on its face
rather than mocking a roster as if it worked.

HEADER
Breadcrumb down to the product, then "Enrolments". Title "Enrolments", subtitle naming the
product. Right: secondary "Export CSV", primary "Enrol a learner".

CAPABILITY STRIP — directly beneath the header, before any content, a Warning-tinted strip two
lines tall: "This console can place learners into a product but cannot yet read back who is
enrolled. The list below is unavailable until that endpoint exists." with a Muted Ink second line
naming the two things that do work — enrolling a learner, and viewing enrolments from the
learner's own member profile — each as a chevron link. Not dismissible.

BODY — the unavailable state, and this is the primary frame: a Panel Surface block filling the
content area with a small line-art mark of a list behind a closed panel, the heading "Enrolment
list not available", one sentence of explanation in plain words, and two buttons — a primary
"Enrol a learner" and a secondary "Open member search" that links to the members area where an
individual learner's enrolments can be seen. No skeleton, no fake rows, no greyed table.

THE READY DESIGN — produce as a clearly labelled second frame headed "For when the endpoint
exists", so the shape is ready without shipping a lie:
a filter bar with a learner search, an "Enrolment type" input with the same free-text datalist,
a "Status" select, and an "Enrolled between" date range; then a table — [checkbox] | Learner
(avatar chip + name over email) | Enrolment type chip | Status pill | Enrolled on (relative +
absolute) | Expires (absolute with a Warning tint inside 30 days, or "No expiry" in Muted Ink) |
Membership ID in 11px monospace with a copy icon | a kebab (Open member profile, Change expiry,
Remove enrolment). A footer with "Showing 1–25 of N", a static "25 per page" caption, and a
paginator. A selection bar offering "Change expiry", "Export selection", and "Remove".
Beneath that frame, a Muted Ink note listing exactly what the ready design needs from the
backend: a GET enrolments endpoint with pagination, an update for expiry, and a delete.

ALSO PRODUCE: the enrol drawer from Screen 2 reused verbatim here; a loading skeleton for the
ready design only; and a 390px mobile frame of the unavailable state.
```

---

## Backend gaps these prompts assume

| Prompt feature                                                                                                         | Status                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| List mock tests, test series, bundles, subscription plans with `q`, `status`, `page` (25 per page) and full `pageInfo` | exists                                                                                                                      |
| Create each of the four product types                                                                                  | exists (POST) — **but there is no UI for it today**, which is what Screen 3 supplies                                        |
| Enrol a learner into any of the four (`membershipId`, free-text `enrolledType`, optional `expiresAt`)                  | exists                                                                                                                      |
| `PUBLISH_STATUSES` (DRAFT / PUBLISHED / ARCHIVED) and `BILLING_INTERVALS` (monthly / yearly / custom)                  | exist                                                                                                                       |
| Bundle and subscription item kinds                                                                                     | exist                                                                                                                       |
| **List who is enrolled in a product**                                                                                  | **missing** — POST only, which is why Screen 5 leads with a capability strip instead of a roster                            |
| Update or remove an enrolment, change an expiry                                                                        | missing                                                                                                                     |
| Product detail endpoint (single product by id)                                                                         | not present as its own route — the detail screens assume one, or a client-side lookup from the list                         |
| Update a product (title, slug, description, status, contents)                                                          | missing — Screens 2, 3, and 4 all assume PATCH support                                                                      |
| Resolved titles for referenced items                                                                                   | missing — the list returns id, kind, and position only, which is why the addendum mandates the "Title not loaded" treatment |
| Slug-collision validation                                                                                              | needs backend for the inline error on Screen 3                                                                              |
| CSV export of the catalogue                                                                                            | missing                                                                                                                     |

Two notes worth carrying into the build. First, this module's status enum is **not** the
`ENTITY_STATUSES` triple used across most of the admin console — a shared status-pill component
that assumes Active / Inactive / Archived will render wrong values here. Second, the current
screen never renders a paginator despite the API returning full `pageInfo`, so a catalogue past
25 items is silently truncated today.
