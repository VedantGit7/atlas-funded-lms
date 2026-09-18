# Google Stitch Prompts — Active Devices (`/admin/reports/active-devices`)

Paste **Block 0 (Design System)** into Stitch first, then paste one screen prompt per generation.
Keep the same Stitch project so the design system carries across screens.

Source of truth for existing behaviour:

- `frontend/apps/web/src/features/admin/reports/AdminActiveDevicesRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-active-devices-roster-api.ts`
- `backend/packages/domain/src/reports/active-devices-roster.{service,repository}.ts`
- Related settings screen: `/admin/security/device-monitor`

---

## Block 0 — Design System (paste once, first)

```text
DESIGN SYSTEM — Atlas Funded LMS, Admin Console

Product: a multi-tenant learning-management admin console. This module is the security/ops
surface where an administrator audits which devices learners are signed in on and revokes
sessions. Tone: calm forensic instrument. Trustworthy, dense, factual. Never playful.

ATMOSPHERE
Density 7 (operator console, information-dense but never cramped). Variance 4 (structured,
left-aligned, asymmetric column weights — no decorative chaos on a security screen).
Motion 3 (restrained: state changes, skeleton shimmer, row hover; nothing cinematic).
Feels like a well-lit air-traffic-control panel, not a marketing dashboard.

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
- Success            #15803D / #62DF7D   — trusted device, healthy status
- Warning            #B45309 / #E6C364   — device-limit warnings, stale sessions
- Danger             #DC2626 / #FF8A80   — revoke actions, flagged sessions, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- Numerals, IDs, IP addresses, fingerprints, user-agent strings, timestamps: JetBrains Mono.
  All identifiers are monospace, always — this is a forensic surface and columns must align.
- Banned: Inter, any serif, any display/script face, all-caps body copy.

COMPONENTS
- Tables are the primary object. Sticky header, 44px rows, zebra-free, 1px Hairline row
  dividers, hover = Raised Surface, selected = Accent Wash with a 2px Accent Indigo left rail.
  Row checkboxes in a 44px-wide leading column. Numeric and date columns right-aligned.
- Buttons: flat fills, 8px radius, no glow, no gradient. Primary = Accent Indigo on white ink.
  Secondary = transparent with Outline border. Destructive = Danger text on transparent with
  Danger border; only the final confirm button inside a modal gets a solid Danger fill.
  Active state translates down 1px. Minimum 44px tap target.
- Status pills: 6px radius, 11px monospace uppercase, tinted background at ~12% of the status
  hue, solid text in the full hue, 1px border. Never a bare colored dot alone.
- Filter bar: a single Sunken Surface strip above the table — label above each control,
  controls on one row, wrapping to two rows below 1024px. Applied filters render as removable
  chips beneath the strip with a "Clear all" text button.
- Panels/cards: 12px radius, 1px Hairline border, no drop shadow except on overlays
  (drawer and modal get a soft, background-tinted shadow, never black).
- Drawers slide from the right at 560px wide, full-width below 768px, with a persistent
  header (title + close) and a sticky footer holding the actions.
- Loading = skeleton rows matching exact column widths. Never a circular spinner.
- Empty state = a small line-art device-cluster mark, one sentence of explanation, and one
  action button. Never bare "No data".
- Error state = an inline Danger-tinted strip at the top of the panel with a Retry button.
  Never a toast for a load failure; toasts are for completed mutations only.
- Every destructive action opens a confirmation modal that names the exact objects affected
  and the count, and states the consequence in plain words.

LAYOUT
Persistent admin left sidebar (240px, collapsible to 64px icon rail) and a top bar holding
breadcrumb, global search, theme toggle, admin avatar. Content max-width 1440px with 32px
gutters. Content column is asymmetric where a master/detail split applies — never 50/50.
Every multi-column layout collapses to a single column below 768px, and tables become
stacked label/value cards on mobile. No horizontal page scroll ever; wide tables scroll
inside their own container with the first column pinned.

MOTION
150–200ms ease-out for hover and state changes. Drawer slides in at 240ms with spring
(stiffness 100, damping 20). Rows in a freshly loaded table fade+rise in with a 20ms stagger,
capped at the first 12 rows. Live "last seen" values pulse once on update. Animate transform
and opacity only. Respect prefers-reduced-motion by dropping to instant state changes.

BANNED
No emojis. No Inter. No serif. No pure black. No neon glow or gradient buttons. No purple
hero gradients. No three-equal-cards KPI row (see each screen for the required KPI treatment).
No generic placeholder names (John Doe, Acme). No round fake numbers (50%, 99.99%). No
marketing copy ("Elevate", "Seamless", "Unleash"). No scroll-cue arrows. No custom cursors.
No overlapping elements. Realistic sample data only: names like "Priya Raghunathan",
"Tomás Beltrán", "Ade Okonjo"; emails on example.com; device IDs as UUID fragments;
counts like 3, 7, 12, 41; percentages like 6.4%, 18.2%.
```

---

## Screen 1 — `/admin/reports/active-devices` (roster index)

```text
Screen: Active Devices — report index. Route /admin/reports/active-devices. Desktop 1440px
web app, using the design system already established. Admin sidebar visible with "Reports"
expanded and "Active Devices" as the active item.

HEADER ZONE
Breadcrumb: Admin / Reports / Active Devices. Page title "Active Devices" with a one-line
subtitle: "Monitor learner sessions, revoke devices, and enforce device limits across the
tenant." Right side of the header holds, in order: a segmented time-window control
(24 hours / 7 days / 30 days / All time, "7 days" selected), a secondary "Device policy"
button that links to security settings, a secondary "Export" button with a caret, and a
primary "Revoke selected" button that is disabled until rows are checked and shows the count
when enabled ("Revoke selected (3)").

SIGNAL STRIP (not three equal cards)
Directly under the header, one Panel Surface strip divided by vertical hairlines into four
UNEQUAL cells: the first cell is double width and carries the headline figure.
1. "Active devices" — 4,318 in 32px monospace, with a small sparkline of the last 14 days
   drawn as a thin Accent Indigo line, and a delta caption "+218 vs previous 7 days".
2. "Learners signed in" — 1,946, caption "82% of active learners".
3. "Over device limit" — 27 in Warning, caption "policy: 3 devices", the whole cell is
   clickable and filters the table.
4. "Flagged sessions" — 9 in Danger, caption "shared credentials, impossible travel",
   clickable through to the alerts screen.

FILTER BAR
A Sunken Surface strip with labelled controls on one row: a search input (placeholder
"Search learner name, email, IP, or device ID"), a "Device type" multi-select (Web, iOS,
Android, Desktop app, Tablet), a "Last seen" select (Any time, Last hour, Last 24 hours,
Last 7 days, Older than 30 days), a "Status" select (All, Trusted, Unrecognised, Flagged,
Over limit), a "Course / batch" combobox, a "Location" combobox listing countries, and a
"More filters" ghost button. Beneath the strip, three active filter chips are shown —
"Device type: iOS", "Last seen: Last 24 hours", "Status: Over limit" — each with an x, plus
a "Clear all" text button and a right-aligned "Save as view" text button. Above the table,
a row of saved-view tabs: "All learners" (active), "Over device limit", "Flagged", "Never
signed in", and a "+ New view" tab.

MAIN TABLE — one learner per row, full content width (no side panel on this screen)
Columns: [checkbox] | Learner (avatar initial chip + display name over email in Muted Ink) |
Devices (count as a monospace number followed by small platform glyph chips, e.g. "4" then
web/ios/android marks; if count exceeds the policy limit, the number renders as a Warning
pill) | Device types (comma-joined, truncated with "+2") | Locations (primary country plus
"+1 more") | Last seen (relative "12 min ago" with the absolute timestamp beneath in
monospace 11px) | Status (pill: Trusted / Unrecognised / Flagged / Over limit) |
row actions (kebab menu). Right-align Devices and Last seen. Sortable headers on Devices,
Last seen, and Learner with a small caret on the active sort (Last seen, descending).
Show 12 realistic rows with varied statuses. The kebab menu is shown open on one row with:
View devices, Force sign out of all devices, Set device limit for learner, Mark as trusted,
Open member profile, Copy membership ID.

SELECTION BAR
When rows are checked, a floating action bar docks above the table footer, Raised Surface
with a hairline border: "3 learners selected" on the left; on the right "Force sign out",
"Export selection", "Clear". Render this bar visible in the design.

FOOTER
Left: "Showing 1–25 of 1,946 learners". Middle: page-size select (25 / 50 / 100). Right:
paginator with first/prev/page numbers/next/last. A right-aligned caption in Muted Ink:
"Data refreshed 2 minutes ago" with a small refresh text button.

ALSO PRODUCE, as separate stacked frames on the same canvas:
A. Loading state — skeleton rows matching exact column widths, signal strip figures as
   shimmer bars.
B. Empty state — line-art cluster of a laptop, phone, and tablet; heading "No active devices
   in this window"; sentence "Nothing matched these filters. Widen the time window or clear
   filters."; a primary "Clear filters" button.
C. Error state — inline Danger strip at the top of the table panel reading "Couldn't load the
   device roster." with a Retry button; the rest of the panel dimmed.
D. Mobile 390px — signal strip becomes a two-up grid, filter bar collapses to a search field
   plus a "Filters (3)" button opening a bottom sheet, and each table row becomes a stacked
   card showing learner, device count, last seen, status pill, and a kebab.
```

---

## Screen 2 — `/admin/reports/active-devices/[membershipId]` (learner device detail)

```text
Screen: Learner device detail. Route /admin/reports/active-devices/[membershipId].
Same design system, same shell.

HEADER
Breadcrumb: Admin / Reports / Active Devices / Priya Raghunathan. A back text-link "All
learners". Title row: 40px avatar chip, learner display name as page title, email beneath in
Muted Ink monospace, and inline pills: "Learner", "Batch: Foundations Cohort 12",
"Over device limit". Right side: secondary "Open member profile", secondary "Set device
limit", destructive-outline "Force sign out of all devices".

CONTEXT STRIP
A single hairline-divided strip of unequal cells: "Active devices 5 of 3 allowed" (the 5 in
Warning monospace) | "First seen 14 Mar 2026" | "Last activity 8 minutes ago" |
"Countries seen 2" | "Flags 1 — concurrent sessions in Pune and Lisbon".

LAYOUT — asymmetric two-column, 68/32
LEFT COLUMN — device sessions table, one row per session:
[checkbox] | Device (platform glyph + friendly label "MacBook Pro · Chrome 141" with the
device ID beneath in 11px monospace, truncated to 12 chars with a copy icon) | OS / browser |
IP address (monospace) with the resolved city and country beneath | First seen | Last seen
(relative + absolute) | Status pill (Current session / Active / Idle / Flagged) | actions
(kebab: View session detail, Revoke device, Mark trusted, Block fingerprint, Copy device ID).
The row representing the admin-visible current session carries an Accent Indigo left rail and
a "Current" pill. Show 5 rows including one Flagged row rendered with a faint Danger tint.
Table header holds a left "5 devices" caption and right-side "Revoke selected" (disabled
until checked) and "Select all".

RIGHT COLUMN — three stacked panels:
1. "Device limit" — the policy value (3) with a "Tenant default" caption, an override control
   showing "Override for this learner" with a stepper and an "Apply override" button, and a
   line "Enforcement: block new sign-ins" with a link to the policy screen.
2. "Recent activity" — a vertical timeline, 6 entries, each with a monospace timestamp on the
   left rail and a one-line description: new device signed in from Lisbon; device revoked by
   admin Nandita Rao; password changed; sign-in blocked — device limit reached; sign-in from
   new IP; session expired. Flagged entries get a Danger dot on the rail. A "View full audit
   log" text link at the bottom.
3. "Risk signals" — a short list of evaluated checks with pass/warn/fail pills: concurrent
   sessions in distant locations (fail), device count over policy (warn), all devices
   recognised (pass), no shared IP with other learners (pass).

STATES to also produce: skeleton loading for both columns; an empty right-column timeline
reading "No account activity recorded in this window"; and a 390px mobile frame where the
right column stacks under the sessions list and each session becomes a card.
```

---

## Screen 3 — `/admin/reports/active-devices/[membershipId]/[deviceId]` (single session forensic view)

```text
Screen: Device session detail. Route /admin/reports/active-devices/[membershipId]/[deviceId].
Presented as a right-side drawer over the learner detail screen at 560px wide, AND as a
standalone full page frame for deep links. Produce both.

DRAWER HEADER
Platform glyph, title "MacBook Pro · Chrome 141", subtitle with the full device ID in
monospace and a copy button, a Status pill ("Flagged"), and a close x.

BODY — labelled definition rows in two columns (label in Muted Ink 12px above a monospace
value), grouped under hairline section titles:
- Session: device ID, session token ID (masked, last 6 shown), created at, last seen at,
  expires at, session age.
- Client: platform, operating system with version, browser with version, app build if native,
  screen resolution, language, timezone.
- Network: current IP, ISP/ASN, city, region, country, and a small flat map thumbnail with a
  single Accent Indigo pin — muted landmass, no satellite imagery, no 3D.
- Fingerprint: the fingerprint hash in a full-width Sunken Surface code block with a copy
  button, a caption "Seen on 2 other accounts in this tenant" that links to a matches list,
  and a "Block this fingerprint" destructive-outline button.
- Raw user agent: full string in a wrapping monospace code block with a copy button.

ACTIVITY
A compact table of the last 10 requests from this device: timestamp (monospace), event
(Sign-in, Lesson view, Quiz submit, Token refresh, Sign-in blocked), resource, result pill
(OK / Blocked). Above it, a thin 24-hour activity heatstrip: 24 slim bars, height by request
volume, Accent Indigo, with the flagged hour rendered in Danger.

STICKY FOOTER
Secondary "Mark as trusted", secondary "Export session JSON", destructive "Revoke this
device". A caption above the footer: "Revoking signs this device out immediately and clears
its refresh token."

Also produce: the "Revoke device" confirmation modal — title "Revoke this device?", body
naming the device label, the learner, and the last-seen location, a warning line "The learner
will be signed out on this device immediately and will need to sign in again.", an optional
"Reason" select (Suspected sharing / Lost or stolen / Policy violation / Cleanup / Other), a
"Notify the learner by email" checkbox checked by default, then Cancel and a solid Danger
"Revoke device" button. And a busy variant of the modal where the confirm button shows an
inline progress state and both buttons are disabled.
```

---

## Screen 4 — `/admin/reports/active-devices/alerts` (flagged sessions queue)

```text
Screen: Device alerts queue. Route /admin/reports/active-devices/alerts. Same shell, with a
horizontal tab strip under the page title shared by every screen in this module:
Overview · Alerts · Policies · Exports. "Alerts" active.

HEADER
Title "Device alerts", subtitle "Sessions that tripped a device or location rule. Triage,
resolve, or dismiss." Right side: an "Alert rules" secondary button and a primary
"Resolve selected" button.

TRIAGE RAIL — a left rail 220px wide listing alert categories with counts, the active one
carrying an Accent Wash fill and Accent Indigo left rail: All open (9), Impossible travel (2),
Concurrent sessions (3), Device limit exceeded (4), Shared fingerprint (2), New country (5),
Resolved (63), Dismissed (11). A hairline separates open from closed groups.

MAIN — alert list, not a plain table: each alert is a full-width row of Panel Surface with a
4px left rail coloured by severity (Danger / Warning / Muted). Row content, left to right:
severity pill (Critical / Warning / Info); the alert title in 15px/600 — "Two active sessions
1,850 km apart within 40 minutes"; a second line naming the learner and email; a third line
of monospace evidence chips — "Pune, IN · 103.21.x.x", "Lisbon, PT · 188.250.x.x",
"Δ 38 min"; on the right, the detection timestamp (relative + absolute), an assignee avatar
or "Unassigned", and a kebab (View learner devices, Revoke both sessions, Assign to me,
Snooze 24h, Dismiss with reason). Show 6 alerts across all three severities. Checkbox at the
row start for bulk triage.

DETAIL DRAWER — produce one frame with an alert expanded in the right drawer: the rule that
fired and its threshold, a two-column side-by-side comparison of the two conflicting sessions
(device, IP, city, timestamp), a map thumbnail with two pins and a connecting arc, an
"Evidence" section, an internal notes composer with existing notes stamped by admin name and
time, and a sticky footer with "Revoke both devices" (destructive), "Mark resolved", and
"Dismiss".

STATES: an empty state for the Resolved tab with a line-art shield-and-check mark and the
line "No alerts in this category"; and a mobile 390px frame where the triage rail becomes a
horizontally scrollable chip row above the alert list.
```

---

## Screen 5 — `/admin/reports/active-devices/policies` (device limit rules)

```text
Screen: Device policies. Route /admin/reports/active-devices/policies. Tab strip active on
"Policies". This screen configures what the report enforces; it must feel like settings, not
a report — so the tables recede and forms lead.

HEADER
Title "Device policies", subtitle "Set how many devices a learner may keep signed in and what
happens when they exceed it." Right side: "View audit log" secondary and a primary "Save
changes" button, disabled until a field changes, with an unsaved-changes caption in Warning
beside it when dirty.

SECTION 1 — Tenant default, a Panel Surface form:
- "Devices allowed per learner" numeric stepper, value 3, helper "Counts every signed-in
  session, including web and mobile."
- "When the limit is reached" segmented control: "Block the new sign-in" (selected) /
  "Sign out the oldest device" / "Allow and raise an alert".
- "Idle session expiry" select: 7 days / 14 days / 30 days / 90 days / Never.
- "Require re-verification on a new device" toggle, on, helper "Sends a one-time code by
  email before the session is created."
- "Notify the learner on new device sign-in" toggle, on.
- "Alert admins when a fingerprint appears on multiple accounts" toggle, on, with a
  "Threshold" numeric field showing 2.
Layout these as label-above-control rows in two columns, with each toggle row spanning full
width and its helper text beneath — not a wall of identical inputs.

SECTION 2 — Role and cohort overrides, a compact table:
Scope (role or batch chip) | Devices allowed | On limit reached | Applies to (count of
learners) | Updated by | actions (edit, delete). Four rows: Instructors — 8; Batch
"Foundations Cohort 12" — 5; Role "Support" — 2; Learner override for Tomás Beltrán — 4.
Above the table a "Add override" secondary button; a caption explains precedence: "Learner
override beats batch, batch beats role, role beats tenant default."

SECTION 3 — Blocked fingerprints, a small table: fingerprint (truncated monospace + copy),
reason, blocked by, blocked at, accounts affected, and an "Unblock" text button per row.
Empty state: "No fingerprints are blocked."

Also produce: the "Add override" modal — scope type radio (Role / Batch / Individual
learner), a dependent combobox for the target, devices-allowed stepper, on-limit select, an
optional expiry date, then Cancel and a primary "Create override". And the leave-with-unsaved
-changes confirmation modal.
```

---

## Screen 6 — `/admin/reports/active-devices/exports` (export & scheduled delivery)

```text
Screen: Exports. Route /admin/reports/active-devices/exports. Tab strip active on "Exports".

HEADER
Title "Exports", subtitle "Download the device roster or schedule recurring delivery to your
security team." Primary button "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (name in monospace with a format chip CSV / XLSX / JSON),
Scope (a summary of the filters applied, e.g. "Over device limit · last 7 days"), Rows,
Size, Requested by, Created (relative + absolute), Status pill (Queued / Building / Ready /
Failed / Expired), action (Download text button, or Retry on failure). Show 6 rows covering
every status; the Building row shows a thin determinate Accent Indigo progress bar under the
file name; the Expired row is dimmed with the caption "Files are deleted after 7 days".

RIGHT: "Scheduled exports" — stacked cards, each with a name ("Weekly device audit"), a
cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips (two email chips plus a
webhook chip), the format chip, a "Next run in 2 days" caption, an enabled toggle, and a
kebab (Edit, Run now, Duplicate, Delete). Show two schedules, one disabled and rendered at
reduced emphasis. A dashed-border "New schedule" tile at the end of the stack.

MODAL — "New export": step-free single form with grouped sections — Columns (a two-column
checkbox list: learner name, email, membership ID, device count, device IDs, platform, OS,
browser, IP, city, country, first seen, last seen, status, flags; with "Select all" and a
"Sensitive fields" note in Warning next to IP and fingerprint); Filters (a read-only summary
of the currently applied report filters with a "Use current filters" toggle, on); Format
(segmented CSV / XLSX / JSON); Delivery (radio: Download now / Email me when ready / Send to
recipients, revealing an email chips input and an optional webhook URL); and a "Schedule this
export" toggle that reveals cadence, time, and timezone controls. Footer: Cancel and a
primary "Create export".

Also produce: a ready-state toast "device-roster-2026-08-04.csv is ready" with a Download
action, and the failed-export detail popover showing the error reason and a Retry button.
```

---

## Backend gaps these prompts assume

The prompts intentionally describe the full best-in-class version. Today the API only backs
the roster list, per-learner devices, bulk delete, and force-sign-out. Not yet backed:

| Prompt feature                                                             | Status                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Roster list, learner devices, revoke, force sign-out                       | exists                                                              |
| Email / platform filters, pagination                                       | exists                                                              |
| IP, platform, fingerprint, user agent, first/last seen fields              | exists on `device_sessions`                                         |
| Geo resolution (city/country/ISP), maps                                    | needs backend                                                       |
| Device-limit policy, overrides, enforcement modes                          | partly in `/admin/security/device-monitor` — verify before building |
| Alerts engine (impossible travel, concurrent sessions, shared fingerprint) | needs backend                                                       |
| Fingerprint blocklist                                                      | needs backend                                                       |
| Saved views, export history, scheduled exports                             | export pipeline exists under reports; scheduling needs backend      |
| Per-session request activity / heatstrip                                   | needs an event source                                               |
