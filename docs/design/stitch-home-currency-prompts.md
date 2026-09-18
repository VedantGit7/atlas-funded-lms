# Google Stitch prompts — Home Currency (`/admin/learner-billing/home-currency`)

## Source of truth

| Concern                          | File                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Route page (server fetch + gate) | `frontend/apps/web/src/app/admin/learner-billing/home-currency/page.tsx`       |
| Main panel                       | `frontend/apps/web/src/features/admin/learner-billing/HomeCurrencyPanel.tsx`   |
| Currency picker modal            | `frontend/apps/web/src/features/admin/learner-billing/CurrencySelectModal.tsx` |
| Currency list + display names    | `frontend/apps/web/src/features/admin/learner-billing/currency-options.ts`     |
| Underlying ISO list              | `frontend/apps/web/src/features/courses/supported-currencies.ts`               |
| FX rates panel (same page)       | `frontend/apps/web/src/features/admin/learner-billing/FxRatesPanel.tsx`        |
| Write endpoint                   | `frontend/apps/web/src/app/api/v1/learner-billing/home-currency/route.ts`      |
| Schemas                          | `frontend/packages/contracts/src/domain-config/schemas/learner-billing.ts`     |
| Module nav                       | `frontend/apps/web/src/features/admin/learner-billing/learner-billing-nav.ts`  |

## Key findings that shape the design

1. **This page is two panels, not one.** `HomeCurrencyPanel` (the setting) and `FxRatesPanel`
   (the live rate table) are rendered as siblings inside `LearnerBillingSettingsShell`. Any
   design that shows only the currency selector is missing half the screen.
2. **The change flow is confirm-then-choose, not choose-then-confirm.** `Step = "idle" |
"confirm" | "select"`. Pressing **Change** opens a **danger-toned** confirm dialog first;
   only after "Yes, change" does the currency list appear. This ordering is unusual and is
   deliberate — preserve it.
3. **Home currency is a display relabel, not a conversion.** The confirm dialog states it
   verbatim: _"an amount of 100 keeps its value, only the symbol changes."_ No FX is applied
   to reports. This is the single most important thing the screen must communicate.
4. **…but the FX panel on the same page _is_ a real conversion table.** Those rates convert
   _product prices for learners_, against the home currency as base. Two different mechanisms,
   one page. They must be visually and verbally separated or the screen actively misleads.
5. **`homeCurrency` is `string | null`.** "No currency selected" is a genuine first-run state,
   not an error.
6. **There is no `GET /api/v1/learner-billing/home-currency`.** The value arrives via the
   server-rendered `GET /api/v1/learner-billing/config`; the route file exports `PUT` only.
   There is no client-side refetch and no optimistic rollback path.
7. **Saving propagates app-wide immediately** — `setDisplayCurrency(...)` from the currency
   context fires on success, so every other admin surface relabels without a reload.
8. **The currency list is runtime-derived**, from `Intl.supportedValuesOf("currency")` with a
   57-code hardcoded fallback. It is ~300 entries — a scrolling searchable list, never a
   `<select>`. Search matches **name or code**.
9. **Save is disabled when the selection equals the current code** (`canSave = selected != null
&& selected !== currentCode && !busy`). Re-picking the same currency is a dead end by design.
10. **`/home-currency` has no child routes.** Its "subscreens" are the two overlay steps, the
    FX detail, and the gate states. Everything else under `/admin/learner-billing/*` is a
    sibling, not a child.

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
- Success            #15803D / #62DF7D   — public, healthy, saved
- Warning            #B45309 / #E6C364   — needs attention, unused, restricted
- Danger             #DC2626 / #FF8A80   — destructive confirm, failed
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
- Every destructive action opens a confirmation that names the exact objects affected and
  states the consequence in plain words.

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

## Block 0-HC — Home Currency addendum (paste after Block 0, before any screen prompt)

```text
MODULE ADDENDUM — HOME CURRENCY (Learner Billing)

THE ONE RULE THAT OVERRIDES EVERYTHING ELSE ON THIS SCREEN
Home currency is a DISPLAY RELABEL, NOT A CONVERSION. Changing it does not convert a single
stored amount. An amount of 100 stays 100; only the symbol in front of it changes. Never draw
a converted "before → after" preview of report totals. Never show an exchange-rate arrow, an
FX badge, a "≈" sign, or a "your revenue becomes X" figure anywhere in the currency-setting
panel or in either overlay step. If you show a numeric example, it must show the SAME number
under both symbols — that is the entire point.

BUT: THE SAME PAGE ALSO CARRIES A REAL FX TABLE
The Exchange rates panel below it is a genuine conversion table — it converts PRODUCT PRICES
into a learner's own currency, using the home currency as the base. These are two different
mechanisms sitting on one page, and confusing them is the specific failure mode this design
must prevent. Enforce the separation:
- They are two separate panels with their own 1px Hairline borders and their own H2. Never a
  shared card, never a tab set, never side-by-side columns that read as one unit.
- The currency-setting panel's scope line says "reports and statistics".
- The FX panel's scope line says "prices shown to learners".
- The two panels never share a number, a symbol, or a legend.

SCOPE BOUNDARIES — state these, do not let the design imply otherwise
1. Home currency affects REPORTS AND STATISTICS ONLY.
2. The currency shown to LEARNERS is set elsewhere: Settings › Locations. Link to it; never
   offer to edit it here.
3. Platform billing is a third, separate currency. Switching away from the default means the
   school is billed in the platform billing currency.
4. If home currency differs from the "Rest of the world" currency, PRODUCT PRICES display in
   the "Rest of the world" currency while STATISTICS use the home currency. This split is
   real and must be surfaced, not hidden in a tooltip.

THE CHANGE FLOW IS CONFIRM → CHOOSE (in that order)
Step 1 idle    — read-only display of the saved currency + a "Change" button.
Step 2 confirm — a DANGER-toned confirmation, "Change currency?", listing the three
                 consequences below, with "Yes, change" / "Cancel".
Step 3 select  — only now does the searchable currency list open.
Do not reorder this into pick-then-confirm. Do not merge the two overlays. Do not preselect a
currency in step 2. Cancelling at step 3 returns to idle, NOT back to step 2.

THE THREE CONSEQUENCES (verbatim, numbered, in this order, in the confirm dialog)
1. "You will view all transactional reports in the new currency, while the amount stays the
   same. For instance, an amount of 100 keeps its value, only the symbol changes."
2. "You will be billed in your platform billing currency if you switch away from your default
   currency."
3. "If the home currency differs from the 'Rest of the world' currency, product prices are
   shown in the 'Rest of the world' currency, while statistics use the home currency."
Render these as a numbered list, 14px body, Primary Ink, generous 12px spacing between items.
Not bullet dots, not an accordion, not three collapsed rows. All three are visible at once.

NULL IS A REAL STATE
homeCurrency can be null. The read-only field then shows the literal string
"No currency selected" in Muted Ink italic — NOT an em dash, NOT a zero, NOT a red error, NOT
a placeholder currency. The Change button stays enabled; this is first-run, not a fault.

THE CURRENCY LIST
- ~300 ISO 4217 entries, runtime-derived, sorted by display NAME (not code).
- Each row: display name in Primary Ink 14px on the left, the 3-letter code in JetBrains Mono
  12px Muted Ink on the right.
- Never a native <select>, never a dropdown, never a flag-emoji list (emojis are banned).
- A search field pinned at the top of the list, autofocused, placeholder "Search currencies",
  matching against BOTH name and code, case-insensitive substring.
- Empty search result renders: No currencies match "<query>".
- The currently saved currency renders as the selected row (Accent Wash + 2px Accent Indigo
  left rail) when the list opens.
- SAVE IS DISABLED while the selection is null OR equals the currently saved code. Re-picking
  the current currency is intentionally a no-op — the disabled Save is the feedback. Do not
  add a "no change" toast or an error message for it.

AFTER SAVING
One success toast: "Home currency updated." The overlay closes to idle and the read-only field
shows the new currency name immediately. The change propagates to every other admin surface
without a reload — so do NOT design a "reload to see changes" banner. There is no undo.

WRITE CONTRACT
PUT /api/v1/learner-billing/home-currency  body { currency: "<ISO4217>" }
Server uppercases and validates /^[A-Z]{3}$/. There is no GET on this route — the value is
server-rendered from GET /api/v1/learner-billing/config. So there is no client refresh button
for the setting itself, and no "last synced" line on that panel.

MODULE NAV STRIP (exact labels, exact order — this page is item 2)
Pricing Model · Home Currency · Payment Gateway · Goods & Service Tax (GST) ·
Learner Configurations · Invoice Configuration · Locations
Render as a left settings rail at >=1024px (240px, active item = Accent Wash + 2px Accent
Indigo left rail) and as a horizontal scrolling tab strip below that. Labels verbatim.

BANNED ON THIS SCREEN
No currency conversion preview. No exchange-rate arrows or "≈" in the setting panel. No flag
icons or flag emojis. No "recently used currencies" section (not stored). No multi-select. No
"revert to previous currency" control (no history endpoint exists). No inline edit of the
learner-facing currency. No fabricated rate provider name or logo.
```

---

## Prompt 1 — Home Currency (`/admin/learner-billing/home-currency`)

```text
Design the "Home Currency" settings screen of the Atlas admin console, at
/admin/learner-billing/home-currency. Desktop 1440px, plus a 390px mobile variant.

PAGE CHROME
Breadcrumb: Admin › Learner Billing › Home Currency. Page title "Home Currency" 24px/600.
Left settings rail (240px) with the Learner Billing nav: Pricing Model, Home Currency
(active), Payment Gateway, Goods & Service Tax (GST), Learner Configurations, Invoice
Configuration, Locations. Active item = Accent Wash fill with a 2px Accent Indigo left rail.
Content column to the right, max 880px, two stacked panels with a 24px gap.

PANEL 1 — "Home Currency" (the setting)
A Panel Surface card, 12px radius, 1px Hairline border, 24px padding.
- H2 "Home Currency" 16px/600.
- Sub-line 14px Muted Ink: "Set and view all statistics in your preferred currency."
- Field label "Currency" 12px/600 Muted Ink with a red asterisk for required.
- Below it, a READ-ONLY value box: full width minus the button, 44px tall, Sunken Surface
  fill, 1px Outline border, 8px radius, NOT an input — it must not look focusable or typable.
  Inside: a line-art coins icon 18px in Muted Ink, then the currency DISPLAY NAME in Primary
  Ink 14px (e.g. "Indian Rupee"), then the 3-letter code in JetBrains Mono 12px Muted Ink.
- To its right, a secondary button "Change" (transparent, 1px Outline border, 44px tall).
- Beneath the field, a Muted Ink 12px note with a small info glyph:
  "This currency only reflects on reports. To update the currency shown to learners, go to
   Settings › Locations." — with "Settings › Locations" as an Accent Indigo text link.

Show this panel in THREE states, stacked as separate frames labelled A / B / C:
  A — Saved: value box reads "Indian Rupee" + INR.
  B — Not yet set: value box reads "No currency selected" in Muted Ink italic, no code, no
      icon tint change, no red border, no warning pill. The Change button stays enabled.
  C — Saving: the Change button is disabled at 60% opacity while a PUT is in flight; the
      value box is unchanged. No spinner overlay on the panel.

PANEL 2 — "Exchange rates" (a genuinely different mechanism)
A separate Panel Surface card with its own border, clearly detached from Panel 1.
- H2 "Exchange rates" 16px/600.
- Sub-line 14px Muted Ink: "Base INR — Indian Rupee".
- Top-right: a secondary button with a line-art refresh glyph, label "Refresh rates".
- Below the header, a 12px Muted Ink staleness line, JetBrains Mono for the dates:
  "Rates as of 2026-08-26. Last fetched 26 Aug 2026, 4:12 PM."
- The rate list as a responsive grid, 4 columns at 1440px / 3 at tablet / 2 at mobile. Each
  cell is a 1px Hairline bordered pill, 8px radius, 10px 12px padding, containing the code in
  JetBrains Mono 12px Muted Ink on the left and the rate in JetBrains Mono 14px/600 Primary
  Ink right-aligned, max 4 decimal places. Show ~16 realistic cells: AED 0.0442, AUD 0.0181,
  BRL 0.0651, CAD 0.0164, CHF 0.0096, CNY 0.0855, EUR 0.0103, GBP 0.0089, JPY 1.7742,
  KRW 15.9032, MYR 0.0509, NZD 0.0198, SAR 0.0451, SGD 0.0154, USD 0.0120, ZAR 0.2137.
- The list is sorted alphabetically by code. No search, no pagination, no sparklines, no
  up/down arrows, no percentage change — none of that data exists.

CRITICAL SEPARATION: Panel 1 sets which symbol reports are LABELLED with — no conversion ever
happens there. Panel 2 converts PRODUCT PRICES for learners. Nothing may visually imply they
are one control: no connecting line, no shared background, no tab set, no "1 INR = ..." string
anywhere inside Panel 1.

MOBILE 390px
Settings rail becomes a horizontal scrolling tab strip pinned under the title. Panel 1's value
box and Change button stack vertically, both full width. Panel 2's rate grid drops to 2
columns. No horizontal page scroll.

Do not draw the confirm dialog or the currency picker in this frame.
```

---

## Prompt 2 — Change confirmation (`/home-currency` → step "confirm")

```text
Design the "Change currency?" confirmation dialog for the Atlas admin console, the FIRST step
after pressing "Change" on /admin/learner-billing/home-currency. Desktop 1440px overlay plus a
390px mobile variant.

This is a DANGER-toned confirmation. It appears BEFORE any currency has been chosen — the user
is confirming the intent to change, not confirming a specific selection. Nothing in this
dialog names a target currency, previews a new symbol, or shows a "from → to" pair.

BACKDROP
The Home Currency screen behind, dimmed with a background-tinted scrim (never black), 4px
backdrop blur. The page beneath is scroll-locked.

DIALOG
Centered, 520px wide, Panel Surface, 12px radius, 1px Hairline border, soft background-tinted
shadow. 24px padding.
- A 40px circular Danger-wash badge holding a line-art alert-triangle glyph in Danger.
- H2 "Change currency?" 18px/600 Primary Ink, directly beneath the badge.
- Then the three consequences as a NUMBERED list, 14px/400 Primary Ink, 12px between items,
  numerals in JetBrains Mono Muted Ink. Verbatim, in this order:
  1. "You will view all transactional reports in the new currency, while the amount stays the
     same. For instance, an amount of 100 keeps its value, only the symbol changes."
  2. "You will be billed in your platform billing currency if you switch away from your
     default currency."
  3. "If the home currency differs from the 'Rest of the world' currency, product prices are
     shown in the 'Rest of the world' currency, while statistics use the home currency."
  All three are visible at once — no accordion, no "read more", no truncation, no scroll.
- Footer, right-aligned, 12px gap: secondary "Cancel" (transparent, Outline border) and
  primary "Yes, change" with a SOLID Danger fill and white ink. "Yes, change" is the only
  solid-Danger element on screen.

Escape and the scrim both cancel. Focus is trapped; initial focus is on "Cancel", not on
"Yes, change".

EMPHASIS
Consequence 1 is the load-bearing sentence. Set the clause "the amount stays the same" in
600 weight. Do not add an illustration, a currency-symbol comparison graphic, or a numeric
example table — the sentence carries it.

MOBILE 390px
The dialog becomes a bottom sheet, full width, 16px top corners, with a 4px 36px drag handle.
The two buttons stack full-width, "Yes, change" on top, "Cancel" beneath.
```

---

## Prompt 3 — Select currency (`/home-currency` → step "select")

```text
Design the "Select currency" modal for the Atlas admin console — the SECOND step, reached only
after "Yes, change" in the confirmation dialog. Desktop 1440px overlay plus a 390px variant.

BACKDROP
Same dimmed, background-tinted, 4px-blurred scrim over the Home Currency screen. Page
scroll-locked. The confirmation dialog is gone — the two overlays never coexist.

MODAL
Centered, 520px wide, max 640px tall, Panel Surface, 12px radius, 1px Hairline border, soft
background-tinted shadow. Three regions: fixed header, scrolling list, fixed footer.

HEADER (24px padding, no bottom border)
- H2 "Select currency" 18px/600 Primary Ink.
- Sub-line 14px Muted Ink: "Choose the reporting currency for your school."
- A close X icon-button top-right, 18px line-art glyph, 44px hit area, aria-label "Close".
- Below the copy, a search field: full width, 44px tall, Sunken Surface, 1px Outline, 8px
  radius, a 16px line-art magnifier inset 12px from the left, placeholder "Search currencies".
  It is autofocused when the modal opens. Show a focused state with a 2px Accent Indigo ring.

LIST (scrolls independently; the header and footer never move)
~300 rows, sorted by DISPLAY NAME ascending. Each row is a full-width button, 44px tall,
12px horizontal padding, 8px radius, with:
  - the currency display name, Primary Ink 14px, left;
  - the 3-letter ISO code, JetBrains Mono 12px Muted Ink, right-aligned.
Hover = Raised Surface. Selected = Accent Wash fill with a 2px Accent Indigo left rail and a
14px line-art check glyph in Accent Indigo before the code. Rows are separated by 1px Hairline
dividers. No flags, no emoji, no symbol glyphs (₹ $ €), no country names.
Show these rows in view: Australian Dollar AUD, Brazilian Real BRL, British Pound GBP,
Canadian Dollar CAD, Euro EUR, Indian Rupee INR (SELECTED — it is the currently saved one),
Japanese Yen JPY, Malaysian Ringgit MYR, Singapore Dollar SGD, South African Rand ZAR,
Swiss Franc CHF, United Arab Emirates Dirham AED, US Dollar USD.
The list is virtualised — the scrollbar thumb is small, indicating a long list.

FOOTER (24px padding, 1px Hairline top border, right-aligned, 12px gap)
- Secondary "Cancel" (transparent, Outline border).
- Primary "Save" (Accent Indigo fill, white ink).

Show FOUR frames:
  A — Open, "Indian Rupee" pre-selected as the current value, SAVE DISABLED at 60% opacity.
      This is the initial state: you cannot save the currency you already have. Do not add any
      error text or tooltip explaining this — the disabled button is the whole message.
  B — "US Dollar" picked. USD row selected, INR row back to default. Save now ENABLED.
  C — Search active: query "din" typed in the field; the list filtered to
      Bahraini Dinar BHD, Iraqi Dinar IQD, Jordanian Dinar JOD, Kuwaiti Dinar KWD,
      Serbian Dinar RSD, Tunisian Dinar TND — proving the match runs on name AND code.
  D — No results: query "zzz", the list area replaced by a centered block with a small
      line-art magnifier mark and the single line: No currencies match "zzz". No action button.

BUSY STATE
While saving: Save reads "Saving…" and is disabled, Cancel is disabled, the close X is
disabled, and the list stops accepting clicks. The modal does not close until the PUT resolves.

Escape and the scrim cancel and return to the idle screen — NOT back to the confirmation
dialog. Focus is trapped and returns to the "Change" button on close.

MOBILE 390px
Full-screen sheet. Header pinned top with the search field, footer pinned bottom with the two
buttons stacked full-width (Save on top). The list fills everything between.
```

---

## Prompt 4 — Save outcomes (toast + failure)

```text
Design the post-save states for the Home Currency screen of the Atlas admin console.
Desktop 1440px. Two frames.

FRAME A — SUCCESS
Back on the idle Home Currency screen. The read-only value box now reads "US Dollar" with USD
in JetBrains Mono. A single toast, bottom-right, 360px wide, Panel Surface, 1px Hairline
border, 8px radius, soft background-tinted shadow, with a 2px Success left rail and a 16px
line-art check glyph in Success: "Home currency updated." Auto-dismisses after 5s; a close X
sits at its right edge.
There is NO "reload to apply" banner and NO undo link — the change propagates across the whole
admin console immediately and cannot be reverted by a control on this screen.
Optionally show one subtle confirmation of that propagation: the top-bar or a nearby report
figure already rendering with the new symbol. If you include it, the FIGURE ITSELF MUST BE
UNCHANGED — e.g. a revenue value that read "₹ 4,82,610" now reads "$ 4,82,610". Same digits,
different symbol. That is the correct, non-converting behaviour and it is worth showing.

FRAME B — FAILURE
The Select currency modal is still OPEN — a failed save does not close it. Above the footer, an
inline Danger-tinted strip, 8px radius, 1px Danger border, 12px padding, with a line-art alert
glyph and the message "Could not update home currency. Request ID: req_7f3c9a21" — the request
ID in JetBrains Mono. Save is re-enabled; the selection is preserved. No toast for this — load
and mutation failures render inline, toasts are for successes only.
```

---

## Prompt 5 — Exchange rates panel, all states (`/home-currency`, Panel 2)

```text
Design every state of the "Exchange rates" panel on the Atlas admin Home Currency screen.
Content width 880px. Five frames stacked, each labelled.

The panel: Panel Surface card, 12px radius, 1px Hairline border, 24px padding. Header row with
H2 "Exchange rates" 16px/600 on the left, a secondary "Refresh rates" button with a line-art
circular-arrows glyph on the right.

FRAME A — LOADED
Sub-line: "Base INR — Indian Rupee". Staleness line, 12px Muted Ink, dates in JetBrains Mono:
"Rates as of 2026-08-26. Last fetched 26 Aug 2026, 4:12 PM." Then the 4-column rate grid of
bordered pills described in Prompt 1.

FRAME B — LOADING
Sub-line falls back to: "Rates used to convert prices into a learner's currency." Below it, the
line "Loading rates…" in 14px Muted Ink. Refresh button disabled at 60%. No spinner.

FRAME C — REFRESHING
Same as Loaded, but the button label reads "Refreshing…", is disabled, and its glyph is
mid-rotation. The existing rate grid stays fully visible and legible — it is NOT dimmed,
blurred, or replaced by skeletons. Stale-while-refreshing, not blank-while-refreshing.

FRAME D — EMPTY
Rate grid replaced by a centered block: a small line-art exchange mark, then
"No rates stored yet. Refresh to fetch them." No staleness line at all in this state.

FRAME E — ERROR
Above the list area, an inline Danger-tinted strip with a line-art alert glyph:
"Could not refresh exchange rates." Any previously loaded grid REMAINS visible beneath it —
never wipe good data because a refresh failed. Refresh button re-enabled.

STALENESS IS THE POINT OF THIS PANEL. If "Rates as of" is more than 7 days old, the staleness
line switches to Warning ink and gains a small line-art clock glyph. Draw that as an inset
variant of Frame A: "Rates as of 2026-07-03. Last fetched 3 Jul 2026, 9:40 AM." in Warning.
Do not add a threshold badge, a countdown, or an auto-refresh toggle.

BANNED HERE
No trend arrows, no percentage deltas, no sparklines, no historical chart, no rate provider
logo or name, no "1 INR = 0.0120 USD" long-form sentences per row, no currency converter
calculator widget.
```

---

## Prompt 6 — Gate states (permission denied / load error)

```text
Design the two gate states for the Atlas admin Home Currency route, rendered instead of the
panels when the server fetch fails. Desktop 1440px. Two frames.

Both keep the full page chrome: sidebar, breadcrumb Admin › Learner Billing › Home Currency,
page title "Home Currency", and the Learner Billing settings rail with Home Currency active.
Only the content column changes. The rail stays interactive in both.

FRAME A — DENIED (401/403)
Content column holds a single Panel Surface card, 12px radius, 1px Hairline border, 48px
vertical padding, centered content:
- a 48px line-art padlock mark in Muted Ink,
- H2 "Access restricted" 18px/600,
- 14px Muted Ink: "You do not have permission to manage home currency."
- one secondary button: "Back to Learner Billing".
No retry button — retrying cannot help.

FRAME B — LOAD ERROR
Same card shape, but:
- a 48px line-art broken-plug mark in Danger,
- H2 "Couldn't load Home Currency" 18px/600,
- 14px Muted Ink, with the ID in JetBrains Mono:
  "Failed to load home currency. Request ID: req_9b41ce07"
- a primary "Retry" button and a secondary "Copy request ID" button, 12px gap.

Neither state shows a skeleton, a partial form, or a disabled Change button — the panels are
not rendered at all.
```

---

## Prompt 7 — Change history _(design-only — no endpoint exists)_

> **Read this before using Prompt 7.** There is no audit endpoint for home-currency changes.
> `route.ts` exports `PUT` only, and `LearnerBillingConfigResponse` carries a single
> `updatedAt` for the whole billing config — not a per-change log. Do not ship this screen
> until `GET /api/v1/learner-billing/home-currency/history` exists. The prompt below is a
> target design, and it opens with a capability strip that says so.

```text
Design a "Currency change history" drawer for the Atlas admin console, opened from the Home
Currency screen. Desktop 1440px, plus 390px.

CAPABILITY STRIP — draw this first, at the top of the drawer body, and do not omit it:
a Warning-tinted inset strip, 8px radius, 1px Warning border, 12px padding, line-art
info glyph, 13px text: "History is not recorded yet. This view is a design target — the
backend currently stores only the current home currency and a single config-level
updatedAt." The strip is dismissible only by closing the drawer.

DRAWER
Slides from the right, 560px wide, full-width below 768px, Panel Surface, soft
background-tinted shadow. Persistent header: H2 "Currency change history" 18px/600, a
sub-line "Every change to the reporting currency for this school." and a close X.

BODY — a vertical timeline, newest first. Each entry is a row with:
- a 2px Hairline vertical rail on the left with an 8px Accent Indigo node,
- the change itself as "INR → USD", both codes in JetBrains Mono 14px/600 Primary Ink with a
  small line-art arrow between them,
- beneath it, the two display names in 13px Muted Ink: "Indian Rupee to US Dollar",
- beneath that, a 12px Muted Ink metadata line: actor name, then a middot, then an absolute
  timestamp in JetBrains Mono: "Priya Raghunathan · 26 Aug 2026, 4:12 PM".
Show 4 entries and one final "Currency first set" entry with no left-hand code — just
"— → INR", the em dash standing in for the null first-run value.

The whole timeline is rendered at 55% opacity behind the capability strip, and every entry is
non-interactive, to make it unmistakable that this is not live data.

FOOTER
Sticky, 1px Hairline top border, one secondary button "Close". No export, no filter, no date
range — none of that is backed by anything.
```

---

## Backend gaps these prompts assume

| #   | Gap                                                                                     | Where it bites                                                                                                                                                                    | Suggested fix                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No `GET /api/v1/learner-billing/home-currency` — the route exports `PUT` only           | The panel can never refetch; after a failed save the UI has no way to re-read the true server value, and a stale `initialCurrency` survives until a full page reload              | Add a `GET` returning `{ homeCurrency }` and have the panel refetch on save failure                                                                                              |
| 2   | No change-history / audit endpoint                                                      | Prompt 7 is undeliverable; an admin cannot see who changed the reporting currency or when                                                                                         | `GET /api/v1/learner-billing/home-currency/history` returning `{ from, to, actorId, actorName, changedAt }[]`                                                                    |
| 3   | `LearnerBillingConfigResponse.updatedAt` is config-wide, not per-field                  | Cannot show "home currency last changed on …" even approximately — showing the config `updatedAt` here would be a lie whenever GST or invoice settings were touched more recently | Per-section `updatedAt`, or the history endpoint above                                                                                                                           |
| 4   | `CurrencyCodeSchema` accepts any `/^[A-Z]{3}$/` string                                  | The API will happily store `"XYZ"` or a currency the FX provider has no rate for, silently breaking Panel 2's conversions                                                         | Validate against the supported-currency set server-side, and reject codes absent from the FX rate table                                                                          |
| 5   | The "Rest of the world" currency is referenced in consequence #3 but never fetched here | The screen warns about a divergence it cannot actually detect or display                                                                                                          | Expose the Locations "Rest of the world" currency in the config response so the panel can render a live "your home currency differs from your Rest-of-the-world currency" notice |
| 6   | The platform billing currency in consequence #2 is likewise never fetched               | The warning is generic where it could be specific                                                                                                                                 | Include `platformBillingCurrency` in the config response                                                                                                                         |
| 7   | `GET /api/v1/fx/rates` returns `asOf` as an opaque string with no documented format     | The staleness logic in Prompt 5 (Warning ink past 7 days) cannot be implemented reliably                                                                                          | Return `asOf` as an ISO-8601 datetime alongside a `stale: boolean` computed server-side                                                                                          |
| 8   | No FX coverage signal                                                                   | If the newly chosen home currency has no rates, Panel 2 silently shows an unrelated base or an empty grid, and learner-facing prices break with no warning                        | Have the `PUT` response report FX coverage for the new base, and surface a Warning strip when it is missing                                                                      |
| 9   | Changing home currency does not trigger an FX refresh                                   | An admin can set a new base and leave last month's rates in place, mispricing every course                                                                                        | Refresh rates server-side on home-currency change, or return a flag that makes the UI prompt for it                                                                              |
