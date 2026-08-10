# Google Stitch Prompts — Zoom Insights (`/admin/reports/zoom-insights`)

Paste **Block 0 (Design System)** first, then **Block 0-Z (Zoom Insights addendum)**, then one
screen prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the Active Devices, Payments, Progress & Score, Batches,
Polls, Sales & Marketing, and Custom Field files; reproduced here so this file stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminZoomInsightsRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-zoom-insights-roster-api.ts`
- `backend/apps/api/src/app/api/v1/reports/zoom-insights/*`
- Integration endpoints: `backend/apps/api/src/app/api/v1/zoom/{connect,meetings,webhooks}`

Today the module is one page with a two-level drill in local state — meeting list → meeting
detail plus participants — and a `connectionStatus` value (`connected` / `disconnected` /
`unknown`) returned with the list.

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
- Success            #15803D / #62DF7D   — connected, matched, healthy
- Warning            #B45309 / #E6C364   — stale sync, unmatched, partial data
- Danger             #DC2626 / #FF8A80   — disconnected, failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, durations, meeting IDs, counts, timestamps: JetBrains Mono.
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
- Every action that changes a record opens a confirmation that names the exact objects
  affected and states the consequence in plain words.

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

## Block 0-Z — Zoom Insights addendum (paste second)

```text
ZOOM INSIGHTS MODULE ADDENDUM — applies to every screen in /admin/reports/zoom-insights

WHAT THIS MODULE IS
A report over meeting and participant data pulled from a connected Zoom account. It is a
mirror of an external system, not a source of truth — every screen must make that honest.
Nothing here creates or edits a Zoom meeting; the only writes are reconciliation (matching a
Zoom participant to a learner) and triggering a sync.

THE CONNECTION BANNER IS MANDATORY ON EVERY SCREEN
The API returns a connection status of connected, disconnected, or unknown. Render it as a
single full-width strip directly beneath the module tab strip, before any content:
  - connected — a slim Sunken Surface strip, one line: "Zoom connected · last synced 12 minutes
    ago · 3 meetings imported today", with a "Sync now" text button on the right. Quiet, never
    Success-green — a working integration should not shout.
  - disconnected — a Danger-tinted strip two lines tall: "Zoom is not connected. The data below
    was last synced on 14 Jul 2026 and will not update." with a primary "Reconnect Zoom"
    button. All content below stays visible and readable — never blank the page, never grey the
    tables. Stale data is still useful data; it is labelled, not hidden.
  - unknown — a Warning-tinted strip: "Could not verify the Zoom connection. Data may be
    incomplete." with a "Check connection" secondary button.
Design all three variants of Screen 1, and show the connected variant on every other screen.

THIS DATA IS A MIRROR — SAY SO
Any figure sourced from Zoom carries its provenance where an admin might otherwise assume it is
LMS-native. Under every summary band, one Muted Ink caption: "Reported by Zoom. Durations come
from Zoom's participant records and may differ from LMS session attendance." Where this report
and the LMS live-class attendance report disagree, never silently pick one — show both with a
labelled difference.

IDENTITY MATCHING IS THE CENTRAL PROBLEM
A Zoom participant may or may not resolve to a learner in the LMS — the membership link is
nullable. Every participant row shows a match state, as a pill:
  - Matched (Success) — resolved to a learner; the name renders as a link to the member profile
  - Unmatched (Warning) — a Zoom display name and email with no learner behind it; the name
    renders as plain text with the raw Zoom display name in monospace beneath
  - Guest (Muted) — explicitly marked as an external attendee, not expected to match
Never fabricate a learner for an unmatched row, never hide unmatched rows from a count, and
always state matched and unmatched counts together: "184 participants · 171 matched · 13
unmatched".

DURATION RENDERING
Durations are stored in seconds and must always render human-readable in monospace: "48m 12s",
"1h 04m", "38s". Never print raw seconds. Where a session length is known, pair duration with
coverage: "48m 12s of 60m" plus a 3px coverage bar. Warning tint below half the session length.
Zoom reports a participant once per join, so a participant who dropped and rejoined has several
records — always aggregate per person for totals AND keep the individual join records visible,
with a "rejoined ×3" badge in monospace beside the aggregate.

MEETING IDENTITY
A meeting carries an internal id and an external Zoom meeting id. Always show the topic as the
human label and the external id in 11px monospace with a copy icon beneath it. A meeting with
no topic renders "Untitled meeting" in Muted Ink italic-free plain text, with the external id
promoted to the primary line.

DATA REALISM
Meeting topics like "Week 6 — Position sizing live", "Office hours — risk desk", "Onboarding
walkthrough — August intake". External meeting ids as 11-digit monospace numbers: "84920175513".
Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua".
Unmatched Zoom display names that look real and messy: "priya (iPhone)", "T. Beltran",
"Guest 4471". Durations like 48m 12s, 1h 04m, 6m 39s. Counts like 13, 184, 1,206.
```

---

## Screen 1 — `/admin/reports/zoom-insights` (meeting list)

```text
Screen: Zoom Insights — meeting list. Route /admin/reports/zoom-insights. Desktop 1440px, admin
sidebar with "Reports" expanded and "Zoom Insights" active.

HEADER
Breadcrumb: Admin / Reports / Zoom Insights. Title "Zoom Insights", subtitle "Meetings and
participant attendance imported from your connected Zoom account." Right side: a date-range
picker reading "Last 30 days", a secondary "Export CSV" button, a secondary "Sync now" button,
and a primary "Connection settings" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Meetings · Participants · Unmatched · Connection · Exports. Underline tabs, active in Accent
Indigo.

CONNECTION BANNER — directly beneath the tab strip, per the addendum. Produce this screen three
times, once per connection state, changing nothing else.

SUMMARY BAND (unequal cells, first is double width)
"Meetings 84" in 32px monospace with the caption "in the last 30 days" and a thin Accent Indigo
bar strip behind the lower third showing meetings per week. Then: "Participants 1,206" with the
caption "1,148 matched · 58 unmatched" | "Total attendance 612h 40m" | "Average attendance per
meeting 14.4" | "Average duration 47m 18s" with a 3px bar against the average scheduled length.
Beneath the band, the provenance caption from the addendum.

FILTER BAR
Search input ("Search meeting topic or Zoom meeting ID"), "Started from" and "Started to" date
pickers, "Duration" select (Any, Under 15 minutes, 15–60 minutes, Over 60 minutes), "Attendance"
select (Any, No participants, 1–10, More than 10), "Has unmatched participants" toggle, "Linked
to a live session" select (Any, Linked, Not linked), and a "Sort" select (Started ↓, Started ↑,
Attendance ↓, Duration ↓). Applied-filter chips beneath with "Clear all" and "Save as view".
Saved-view tabs above the table: "All meetings" (active), "Has unmatched", "No participants",
"Long meetings", "+ New view".

TABLE — one meeting per row
[checkbox] | Meeting (topic in Accent Indigo at 14px/500, with the external Zoom meeting ID in
11px monospace and a copy icon beneath) | Started (absolute date and time in monospace with a
relative caption) | Ended | Duration (monospace "1h 04m") | Participants (monospace count, with
"171 matched · 13 unmatched" beneath, the unmatched figure in Warning where non-zero) | Total
attendance (monospace "184h 12m") | Average per participant (monospace with a 3px coverage bar
against the meeting duration) | Linked session (the LMS live session title as a link, or "Not
linked" in Muted Ink with a "Link" text button) | kebab (Open meeting, View participants,
Reconcile unmatched, Export meeting, Copy Zoom meeting ID, Open in Zoom). Rows click through to
the meeting detail. Sortable on Started, Attendance, Duration; active sort = Started descending.
Show 12 rows including one untitled meeting rendered per the addendum, one meeting with zero
participants at reduced emphasis with a "No participants recorded" caption, and two with
unmatched participants carrying a Warning left rail.

FOOTER: "Showing 1–50 of 84 meetings", page-size select, paginator.

SELECTION BAR (render visible): "3 meetings selected · 412 participants" with "Export
selection", "Reconcile unmatched", "Clear".

ALSO PRODUCE as separate frames:
A. Loading — skeleton banner, band, and rows matching exact column widths.
B. Empty (connected) — line-art mark of a video tile grid, heading "No Zoom meetings in this
   range", sentence "Only completed meetings are imported. Try widening the date range or
   syncing now.", primary "Sync now".
C. Empty (never connected) — a distinct state: "Zoom is not connected", the sentence "Connect a
   Zoom account to import meeting and participant data.", primary "Connect Zoom", and no table
   at all.
D. Error — inline Danger strip "Couldn't load Zoom meetings." with Retry.
E. Mobile 390px — connection banner wraps to two lines, summary band as a two-up grid, each
   meeting a card with topic, external ID, start time, duration, and the participant split.
```

---

## Screen 2 — `/admin/reports/zoom-insights/[meetingId]`

```text
Screen: Meeting detail. Route /admin/reports/zoom-insights/[meetingId]. Back text-link "All
meetings".

HEADER
Breadcrumb: Admin / Reports / Zoom Insights / Week 6 — Position sizing live. Title: the meeting
topic, with the external Zoom meeting ID beneath in monospace with a copy icon, and a chip
cluster: "Completed", "1h 04m", "184 participants", and either the linked LMS session as a chip
or a Warning chip "Not linked to a session". Right: secondary "Columns", secondary "Export
CSV", secondary "Open in Zoom", primary "Reconcile unmatched (13)" — the count in the label,
and the button rendered as secondary when the count is zero.

SUMMARY BAND (unequal cells, first double width)
"Participants 184" at 32px monospace with the caption "171 matched · 13 unmatched" and a thin
two-segment bar (double width) | "Total attendance 184h 12m" | "Average duration 48m 12s" with
a 3px coverage bar against the 1h 04m meeting length and the caption "75.3% of the meeting" |
"Started 22 Jul 2026, 19:00 IST" | "Ended 20:04 IST". Beneath the band, the provenance caption.

ATTENDANCE TIMELINE — a full-width panel, the primary object: a horizontal time axis spanning
the meeting from start to end, with a filled area showing concurrent participants minute by
minute in Accent Indigo. Vertical markers for the scheduled start and the actual start where
they differ, with a caption naming the gap. Thin Warning ticks where a burst of participants
left. A caption beneath names the peak and the biggest drop: "Peak 172 concurrent at 19:12 ·
21 participants left between 19:44 and 19:48."

CROSS-CHECK PANEL — a slim Sunken Surface strip beneath the timeline, shown only when the
meeting is linked to an LMS live session: three figures side by side — "Zoom reports 184
participants", "LMS attendance records 176", "Difference 8" in Warning — with a one-line
explanation ("8 Zoom participants have no LMS attendance record — usually unmatched identities
or guests") and a "View the difference" text link. When not linked, this strip is replaced by a
single line: "Link this meeting to a live session to compare against LMS attendance." with a
"Link session" secondary button.

FILTER BAR
Name search ("Search participant name"), email search, "Match state" select (All, Matched,
Unmatched, Guest), "Joined from" and "Joined to" time pickers, "Duration" select (Any, Under 10
minutes, 10–30 minutes, Over 30 minutes), "Rejoined" toggle, and a sort select (Join time ↓,
Duration ↓, Name A–Z). Chips beneath with "Clear all".

COLUMNS POPOVER — produce one frame with it open listing the real column set: Name, Email, Join
time, Leave time, Duration — plus the derived columns this screen adds (Match state, Coverage,
Rejoins) in a second group, with checkboxes, drag handles, "Reset to default", and Apply.

PARTICIPANTS TABLE — one row per person, aggregated across rejoins
[checkbox] | Name (matched rows: learner display name as a link to the member profile, with the
Zoom display name beneath in 11px monospace where it differs; unmatched rows: the raw Zoom
display name as plain text with a Warning "Unmatched" pill and a "Match to learner" text button)
| Match state pill | Email (monospace, or "Not provided by Zoom" in Muted Ink) | Join time
(monospace, with a "joined 4m late" caption in Warning where applicable) | Leave time
(monospace, with a "left 12m early" caption where applicable) | Duration (monospace with a 3px
coverage bar against the meeting length and the coverage percentage beneath) | Rejoins (a
monospace "×3" badge, or an em dash) | kebab (View participant sessions, Open member profile,
Match to learner, Mark as guest, Copy Zoom user ID). Unmatched rows carry a Warning left rail.
Show 12 rows spanning all three match states, including two with rejoins and one who attended
under 5 minutes.

SELECTION BAR: "6 participants selected" with "Match to learners", "Mark as guests", "Export
selection", "Clear".

FOOTER: "Showing 1–25 of 184 participants", page-size select, paginator.

ALSO PRODUCE: loading skeleton; the zero-participant empty state ("No participants were
recorded for this meeting", with a sentence noting Zoom sometimes omits participant reports for
very short meetings, and a "Sync now" secondary button); inline error strip; and a 390px mobile
frame where the timeline compresses to a sparkline and participants become stacked cards.
```

---

## Screen 3 — `/admin/reports/zoom-insights/[meetingId]/participants/[participantId]`

```text
Screen: Participant session detail. Route
/admin/reports/zoom-insights/[meetingId]/participants/[participantId]. A right-side drawer over
the meeting detail at 560px, AND a standalone full page for deep links. Produce both, and
produce the drawer twice — once for a matched participant and once for an unmatched one.

HEADER — MATCHED
Avatar chip, learner display name, email beneath in Muted Ink monospace, a Success "Matched"
pill, and a Muted Ink line "Zoom display name: priya (iPhone)" in monospace where it differs
from the learner name. Right / sticky footer: secondary "Open member profile", secondary
"View their other meetings", secondary "Unlink from learner".

HEADER — UNMATCHED
The raw Zoom display name as the title in monospace, the Zoom email beneath in monospace or
"Not provided by Zoom", a Warning "Unmatched" pill, and a one-line explainer: "This Zoom
participant is not linked to a learner, so their attendance is not counted in LMS reports."
Right / sticky footer: primary "Match to learner", secondary "Mark as guest".

SUMMARY STRIP (unequal cells): "Total time 48m 12s" at 28px monospace with a 3px coverage bar
against the 1h 04m meeting and the caption "75.3% of the meeting" (double width) | "Sessions 3"
with the caption "joined and left 3 times" | "First joined 19:04" | "Last left 20:02" | "Longest
gap 6m 41s" in Warning.

JOIN SEGMENTS — the primary object: a horizontal band spanning the meeting duration, with one
filled Accent Indigo segment per join record and hollow Outline gaps between them, the meeting
start and end labelled at each end. Beneath it, a table of the individual records: # (monospace)
| Join time | Leave time | Duration | Share of meeting (percentage with a mini bar) | Device
(the Zoom-reported client where available, as a chip, or "Not reported") | a caption row
beneath the table summarising "3 sessions totalling 48m 12s across a 1h 04m meeting".

CONTEXT — MATCHED ONLY: two stacked panels:
1. "Attendance history" — this learner's last 8 Zoom meetings: meeting topic as a link, date,
   duration, coverage bar, with the current meeting highlighted in Accent Wash, and a caption
   naming their average coverage.
2. "LMS cross-check" — the LMS live-session attendance record for the same session shown beside
   the Zoom figure: two label/value rows ("Zoom reports 48m 12s", "LMS records 46m 30s") and a
   difference line, with an explanatory caption. A variant of this panel reads "No LMS
   attendance record for this session" in Warning.

MATCH DRAWER — produce as its own frame, opened from "Match to learner": a header restating the
Zoom identity (display name, email, user ID in monospace), then a learner search combobox
showing candidates with avatar, name, email, and a small "why suggested" caption ("email
matches", "name is similar", "attended the linked session"). The top three suggestions appear as
a pre-ranked list with a confidence caption. Beneath, a checkbox "Also apply this match to 4
other meetings where this Zoom identity appears" with a "View them" text link. Footer: Cancel
and a primary "Match to Priya Raghunathan". A confirmation restates both identities and notes
that attendance will be recalculated.

ALSO PRODUCE: loading skeleton; a single-session variant where the join-segment band has one
unbroken segment and the sessions table has one row; and a 390px mobile frame where the drawer
becomes a full-screen sheet.
```

---

## Screen 4 — `/admin/reports/zoom-insights/participants`

```text
Screen: Participants across meetings. Route /admin/reports/zoom-insights/participants. Module
tab active on "Participants". The people view, where the meeting list is the sessions view.

HEADER
Title "Participants", subtitle "Every person who has attended a Zoom meeting, across all
meetings in range." Right: date-range picker, secondary "Columns", secondary "Export CSV",
primary "Reconcile unmatched".

SUMMARY BAND (unequal cells, first double width): "People 462" at 32px monospace with the
caption "431 matched · 31 unmatched" and a two-segment bar | "Meetings attended, average 4.2" |
"Total time 612h 40m" | "Average coverage 74.8%" with a 3px bar | "Attended once only 118" with
the caption "25.5% of people". Provenance caption beneath.

FILTER BAR
Search ("Search name, email, or Zoom display name"), "Match state" select (All, Matched,
Unmatched, Guest), "Meetings attended" select (Any, 1, 2–5, More than 5), "Average coverage"
select (Any, Below 25%, 25–75%, Above 75%), "Attended between" date range, "Batch" combobox
(matched participants only, with a caption noting unmatched people cannot be filtered by batch),
and a sort select (Meetings ↓, Total time ↓, Average coverage ↑, Name A–Z). Chips beneath with
"Clear all" and "Save as view".

TABLE — one person per row
[checkbox] | Person (matched: avatar chip + learner name over email, name linking to the member
profile; unmatched: the raw Zoom display name in monospace with the Zoom email beneath and a
"Match to learner" text button) | Match state pill | Meetings attended (monospace, with the
count of meetings in range beneath as "of 84 in range" and a 3px bar) | Total time (monospace
"12h 41m") | Average duration (monospace) | Average coverage (percentage with a 3px bar;
Warning tint below 25%) | First seen | Last seen (relative + absolute; Warning past 30 days) |
kebab (View their meetings, Open member profile, Match to learner, Mark as guest, Export their
attendance). Unmatched rows carry a Warning left rail. Sortable on Meetings, Total time, Average
coverage, Last seen; active sort = Meetings descending. Show 12 rows across all three match
states.

DRILL DRAWER — "Meetings attended" (produce as its own frame): the person at the top with their
totals, then a table of every meeting they joined: meeting topic as a link, external ID in
monospace, date, their duration with a coverage bar, rejoin badge, and a "View session" text
link. A slim strip above the table shows their attendance as one square per meeting in
chronological order, tinted by coverage, hollow where they did not attend a meeting others did.

SELECTION BAR: "8 people selected" with "Match to learners", "Mark as guests", "Export
selection", "Clear".

FOOTER: count line, page-size select, paginator.

ALSO PRODUCE: loading skeleton; empty state "No participants in this range"; inline error strip;
and a 390px mobile frame where each person is a card with meetings, total time, and coverage as
a three-row stack.
```

---

## Screen 5 — `/admin/reports/zoom-insights/unmatched`

```text
Screen: Unmatched identities. Route /admin/reports/zoom-insights/unmatched. Module tab active on
"Unmatched". A reconciliation workbench — the one place in this module built for doing work
rather than reading.

HEADER
Title "Unmatched identities", subtitle "Zoom participants with no learner behind them. Matching
them makes their attendance count in LMS reports." Right: secondary "Export CSV", secondary
"Matching rules", primary "Auto-match suggestions (18)".

SUMMARY BAND (unequal cells, first double width): "Unmatched identities 31" at 32px monospace in
Warning with the caption "across 84 meetings · 412 join records" | "High-confidence suggestions
18" in Success with the caption "email matches a learner exactly", clickable to filter | "Needs
review 9" in Warning | "Likely guests 4" in Muted | "Attendance not counted 84h 12m" with the
caption "would be added to LMS reports once matched".

RECONCILIATION LIST — the primary object, one full-width Panel Surface block per unmatched
identity, not a dense table, because each decision needs context:
LEFT SIDE of the block — the Zoom identity: the display name in 16px monospace, the Zoom email
beneath in monospace or "Not provided by Zoom", the Zoom user ID in 11px monospace with a copy
icon, and a metadata line: "Seen in 6 meetings · 4h 12m total · first 14 Mar 2026, last 22 Jul
2026" with a "View their meetings" text link.
RIGHT SIDE — the suggestion: the top candidate learner as a row with avatar, name, email, and a
confidence chip (High / Medium / Low) plus a plain-language reason ("Zoom email matches this
learner's email exactly", "Display name is similar and they attended the linked session", "Same
email domain only"). Beneath it, "2 other candidates" as a collapsed toggle expanding to more
rows. Then three buttons: a primary "Match" naming the candidate, a secondary "Choose someone
else" opening a learner search combobox inline, and a secondary "Mark as guest".
A checkbox on each block: "Apply to all 6 meetings where this identity appears", checked by
default with the count in the label.
Blocks are grouped under hairline section headers by confidence: "High confidence (18)",
"Needs review (9)", "Likely guests (4)", each header carrying a "Match all in this group" text
button that is present only on the high-confidence group.
Show 6 blocks across all three groups, including one with no candidate at all — its right side
reads "No likely learner found" with a learner search combobox and a "Mark as guest" button.

BULK BAR (render visible at the bottom, docked): "18 high-confidence matches selected" with a
"Review each" secondary and a primary "Match all 18". The confirmation modal lists every pairing
as "Zoom display name → Learner name" in a scrollable monospace list, states how many meetings
and how much attendance will be recalculated, and notes the action can be undone per identity.

MATCHING RULES DRAWER — produce as its own frame: a settings-style panel with toggles for the
rules that generate suggestions — "Match on exact email" (on, High confidence), "Match on
normalised display name" (on, Medium), "Match on email domain plus session enrolment" (off,
Low), "Automatically match high-confidence identities on import" (off, with a Warning caption
"Automatic matching cannot be reviewed before it applies"), and a "Treat these email domains as
guests" chips input.

ALSO PRODUCE: the all-clear empty state — a line-art mark of two linked rings, heading "Every
Zoom participant is matched", the sentence "31 identities were reconciled in the last 30 days.",
and a secondary "View matching rules"; a loading skeleton; and a 390px mobile frame where each
block stacks its two sides vertically with the actions as a full-width button row.
```

---

## Screen 6 — `/admin/reports/zoom-insights/connection`

```text
Screen: Connection and sync. Route /admin/reports/zoom-insights/connection. Module tab active on
"Connection". Produce two variants: connected and disconnected.

HEADER
Title "Connection", subtitle "The Zoom account this report reads from, and the health of the
data coming out of it." Right: secondary "Sync now", destructive-outline "Disconnect Zoom" on
the connected variant; a primary "Connect Zoom" on the disconnected variant.

ACCOUNT PANEL — a Panel Surface block of label/value rows in two columns: connection status pill,
Zoom account name, account email, account ID in monospace with a copy icon, the app or client ID
masked to its last four characters, the scopes granted as a chip row, connected on, connected by,
and token expiry with a Warning caption where it is within 14 days. On the disconnected variant
this panel shows the last known values dimmed, with a Danger caption naming when and why the
connection dropped ("Token revoked in Zoom on 14 Jul 2026").

SYNC HEALTH — an asymmetric 60/40 row:
LEFT: "Sync history" — a table of the last 10 sync runs: Started (monospace, relative +
absolute) | Trigger chip (Scheduled / Manual / Webhook) | Meetings imported | Participants
imported | Duration | Status pill (Completed / Partial / Failed) | a "View log" text link. A
partial row carries a Warning rail with an inline caption naming what was skipped; a failed row
carries a Danger rail with the error message truncated to one line and a "Retry" text button.
Above the table, a slim strip: one small square per day for the last 60 days, tinted by sync
outcome, hollow for days with no run — with a caption "2 failed runs in the last 60 days".
RIGHT: three stacked panels —
1. "Coverage" — "84 meetings imported · 3 meetings reported by Zoom but not imported" in
   Warning, with a "View the gap" text link and a caption explaining that Zoom omits participant
   reports for meetings under a minute.
2. "Webhooks" — the endpoint URL in a monospace field with a copy icon, the signing secret
   masked with a reveal toggle, the last received event with its timestamp, a small list of the
   last 5 events (event type in monospace, meeting topic, response code pill), and a "Send test
   event" secondary button.
3. "Schedule" — the sync cadence ("Every 30 minutes"), a next-run caption, a "Backfill" secondary
   button, and a toggle "Pause automatic syncing" with a Warning caption when on.

BACKFILL MODAL — produce as its own frame: a date-range picker, a caption estimating the work
("About 240 meetings and 3,800 participant records"), a "Skip meetings already imported"
checkbox checked by default, a Warning line about Zoom API rate limits meaning the run may take
several minutes, then Cancel and a primary "Start backfill". Plus a running variant showing a
determinate progress bar with "1,204 of 3,800 records" and a "Stop" secondary.

DISCONNECT MODAL: names the Zoom account, states that already-imported meetings and participants
are kept and remain readable, that no new data will arrive, and that reconnecting the same
account will resume where it left off; requires typing the account email to confirm; then Cancel
and a solid Danger "Disconnect Zoom".

ALSO PRODUCE: loading skeleton; the never-connected variant of the whole screen — a single
centred panel with a line-art plug mark, "Connect a Zoom account", two sentences on what gets
imported, a list of the scopes that will be requested, and a primary "Connect Zoom"; and a 390px
mobile frame where the right rail stacks under the sync history.
```

---

## Screen 7 — `/admin/reports/zoom-insights/exports`

```text
Screen: Zoom Insights exports. Route /admin/reports/zoom-insights/exports. Module tab active on
"Exports".

HEADER
Title "Exports", subtitle "Download Zoom meeting and participant data, or schedule recurring
delivery." Primary "New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Meetings / Participants / Join records / Unmatched identities) | Scope (a filter
summary, e.g. "22 Jul 2026 · Week 6 — Position sizing live") | Rows | Size | Requested by |
Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) |
action (Download, or Retry on failure). Show 7 rows covering every status; the Building row
carries a thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files are
deleted after 7 days".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly Zoom attendance"), dataset chip,
cadence line ("Every Monday, 07:00 Asia/Kolkata"), recipient chips, format chip, "Next run in 3
days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two schedules, one
disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Meetings / Participants / Join records / Unmatched
identities — with a caption under each explaining the grain: "One row per meeting", "One row per
person per meeting, aggregated across rejoins", "One row per join and leave, not aggregated",
"One row per unresolved Zoom identity"). Scope (a meeting multi-select combobox with an "All
meetings in a date range" shortcut, plus the date-range picker). Columns (a two-column checkbox
list matching the real set — name, email, join time, leave time, duration — plus a second group
for the derived columns: match state, membership ID, coverage, rejoins; with "Select all" and a
Warning caption beside email reading "Contains personal data reported by Zoom"). Identity
handling (a radio: "Include unmatched participants" / "Matched participants only", with a
caption naming how many rows each option produces). Format (segmented CSV / XLSX / JSON).
Delivery (radio: Download now / Email me when ready / Send to recipients, revealing an email
chips input and an optional webhook URL). A "Schedule this export" toggle revealing cadence,
time, and timezone. Footer: Cancel and a primary "Create export".

ALSO PRODUCE: a ready toast "zoom-participants-2026-08-07.csv is ready" with a Download action;
a failed-export popover showing the error reason and Retry; and a mobile frame where schedule
cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                             | Status                                                                                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Meeting list: external meeting ID, topic, started/ended, duration, attendance count        | exists                                                                                                            |
| `connectionStatus` returned with the list (connected / disconnected / unknown)             | exists — the mandatory banner is already backed                                                                   |
| Meeting detail: total attendance seconds, average duration                                 | exists                                                                                                            |
| Participant list: display name, email, join/leave time, duration, nullable membership link | exists                                                                                                            |
| Participant filters (name, email, joined range), sort, column picker                       | exists                                                                                                            |
| Async CSV export                                                                           | exists                                                                                                            |
| Zoom connect / meetings / webhook endpoints                                                | exist under `/api/v1/zoom` — verify what each returns before wiring Screen 6                                      |
| Concurrency timeline, peak and drop detection                                              | join/leave times exist per participant; the minute-by-minute aggregate needs backend                              |
| Per-person aggregation across rejoins, rejoin counts                                       | derivable, but not returned today                                                                                 |
| Cross-meeting participants view, first/last seen, average coverage                         | needs backend                                                                                                     |
| Match suggestions, confidence scoring, matching rules, bulk match, mark-as-guest, unlink   | needs backend — **this module is entirely read-only today**, and reconciliation is its biggest missing capability |
| Linking a Zoom meeting to an LMS live session, and the cross-check against LMS attendance  | needs backend                                                                                                     |
| Sync history, sync outcome per day, coverage gap detection, backfill, pause syncing        | needs backend                                                                                                     |
| Webhook event log and test event                                                           | the webhook route exists; the log does not                                                                        |
| Saved views, export history, scheduled exports                                             | export runs exist; history UI and scheduling need backend                                                         |
| Device reported per join record                                                            | not in the participant DTO — check what the Zoom payload stores before rendering it                               |
