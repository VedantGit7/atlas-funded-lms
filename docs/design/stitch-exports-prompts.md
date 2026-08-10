# Google Stitch Prompts — Exports (`/admin/reports/exports`)

Paste **Block 0 (Design System)** first, then **Block 0-EX (Exports addendum)**, then one screen
prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the other report-module files; reproduced here so this file
stands alone.

Source of truth:

- `frontend/apps/web/src/features/admin/reports/AdminExportsRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-exports-roster-api.ts`
- `backend/packages/domain/src/reports/exports-roster.dto.ts`
- `backend/packages/domain/src/reports/reports.contract.ts` (`JOB_STATUSES`)
- `backend/packages/domain/src/reports/reports.registry.ts` (the definition keys)
- `backend/apps/api/src/app/api/v1/reports/runs/[runId]` (run detail)

**This is the meta-module.** Every other report has its own Exports tab; this one is the
tenant-wide ledger they all feed into. Treat the per-module tabs as prefiltered views of this
screen — same row shape, same status vocabulary, same download rules — and make this the only
place where retention, destinations, and governance are configured.

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
- Success            #15803D / #62DF7D   — succeeded, ready, healthy
- Warning            #B45309 / #E6C364   — queued, running, expiring, needs attention
- Danger             #DC2626 / #FF8A80   — failed, expired, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, file names, run IDs, definition keys, counts, timestamps: JetBrains Mono.
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
- Every action that deletes a file, sends data outside the console, or changes retention opens
  a confirmation that names exactly what leaves or disappears, and states it in plain words.

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

## Block 0-EX — Exports addendum (paste second)

```text
EXPORTS MODULE ADDENDUM — applies to every screen in /admin/reports/exports

WHAT THIS MODULE IS
The tenant-wide ledger of every data extraction: what was pulled, from which report, by whom,
when, and whether the file still exists. Every other report module has its own Exports tab —
those are prefiltered views of this same ledger, and must never diverge from it in row shape,
status vocabulary, or download rules. This module is also the only place where retention,
delivery destinations, and export governance are configured.
Its second audience is compliance. Exports carry personal data out of the console, so this
screen is as much an audit trail as it is a download list. Design it that way: never hide who
requested what, never lose a failed run, never let a file's fate be ambiguous.

TWO SOURCE TYPES — KEEP THEM DISTINCT
Every row is either a report_run (an ad-hoc run of a report definition) or an export_job (a
larger or scheduled extraction job). These are different pipelines with different guarantees,
so never merge them into a single "type" column or a shared icon. Render the source as a plain
chip with the exact word — "Report run" or "Export job" — and provide a top-level filter for it.
Where the two behave differently (retry semantics, file size limits, delivery options), say so
in a caption rather than silently offering an action that will not work.

STATUS — THE REAL FIVE
Queued (Warning) · Running (Warning, with a determinate progress bar where progress is known) ·
Succeeded (Success) · Failed (Danger) · Cancelled (Muted).
Render them in sentence case even though the API stores them uppercase. Never invent "Ready",
"Building", or "Expired" as statuses — expiry is a property of the file, not of the run, and is
shown separately per the rule below.

THE FILE IS NOT THE RUN — THREE FLAGS, ONE AFFORDANCE
Each row carries three independent facts: whether the run succeeded, whether a file exists, and
whether the current admin may download it. Resolve them into exactly one affordance per row and
never show a dead button:
  - Succeeded + file exists + downloadable → a primary "Download" text button with the file
    size beside it.
  - Succeeded + file exists + not downloadable → the word "Restricted" in Muted Ink with a
    caption naming why ("Only the requester and owners can download this file").
  - Succeeded + no file → "File removed" in Muted Ink with the removal date and a "Re-run"
    text button.
  - Failed → "Retry" text button plus the first line of the error, truncated, with the full
    message on the run detail.
  - Queued or Running → no download affordance at all, and a "Cancel" text button while it is
    still cancellable.
Expiry renders as its own column: an absolute date in monospace with a relative caption,
Warning-tinted within 48 hours of expiring, and "Expired" in Muted Ink once past — the row
itself stays fully legible, because the audit record outlives the file.

THE SIXTEEN REPORT DEFINITIONS (real keys — use these exactly)
enrollments · progress-score · resource-usage · exports · active-devices · payments · batches ·
polls · sales-marketing · custom-field · zoom-insights · live-class-attendance ·
super-live-insights · assessment-items · certificates · at-risk-roster.
Wherever a report is named, show its human title with the definition key in 10px monospace
beneath — the key is what appears in support tickets and API calls. A run whose definition has
since been removed shows the key alone with a Muted caption "Definition no longer available".

PERSONAL DATA IS THE DEFAULT ASSUMPTION
Any export containing learner names, emails, addresses, IP addresses, or payment details is
flagged. In tables, a small Muted "Contains personal data" chip sits beside the report name; in
any creation flow, a Warning caption sits against the offending column group; in delivery,
sending to an external destination requires an explicit acknowledgement. Never block the export
— state the fact and let the operator decide.

DATA REALISM
File names in monospace: "payments-transactions-2026-08-04.csv",
"progress-foundations-2026-08-05.xlsx", "batch-foundations-c12-2026-08-06.csv". Run IDs as
8-character monospace fragments. Requester names like "Nandita Rao", "Priya Raghunathan",
"Ade Okonjo". Row counts like 1,284, 12,840, 341. Sizes like 4.2 MB, 812 KB, 46.1 MB.
```

---

## Screen 1 — `/admin/reports/exports` (export history ledger)

```text
Screen: Exports — history ledger. Route /admin/reports/exports. Desktop 1440px, admin sidebar
with "Reports" expanded and "Exports" active.

HEADER
Breadcrumb: Admin / Reports / Exports. Title "Exports", subtitle "Every data extraction across
all reports — what was pulled, by whom, and whether the file still exists." Right side: a
date-range picker reading "Last 30 days", a secondary "Columns" button, a secondary "Export this
list" button with the caption-worthy irony left unremarked, and a primary "New export" button.

MODULE TAB STRIP (shared by every screen in this module, under the header)
History · Schedules · Destinations · Settings. Underline tabs, active in Accent Indigo.

SUMMARY BAND — driven by the API's own summary object, unequal cells, first double width
"Exports 1,284" in 32px monospace with the caption "in the last 30 days" and a thin Accent
Indigo bar strip behind the lower third showing runs per day. Then: "Succeeded 1,196" in Success
with the caption "93.1%" | "Failed 47" in Danger, clickable to filter | "Queued or running 12"
in Warning with a caption naming the oldest queued item | "Files available 218" with the caption
"64 expiring in the next 48 hours" and a Warning tint on that figure.

FILTER BAR
Search input ("Search file name, report, or requester"), "Source" select (All, Report run,
Export job), "Status" multi-select (Queued, Running, Succeeded, Failed, Cancelled), "Report"
combobox listing all sixteen definitions with their keys in monospace beside each label,
"Requested by" combobox, "Created from" and "Created to" date pickers, "File" select (Any,
Available, Removed, Expired, Expiring soon), and a "Format" select (CSV, XLSX, JSON). Applied
chips beneath with "Clear all" and "Save as view". Saved-view tabs above the table: "All
exports" (active), "Failed", "Running now", "Expiring soon", "My exports", "+ New view".

COLUMNS POPOVER — produce one frame with it open listing the real column set exactly: Source,
Report, Definition key, Status, Format, Rows, Requested by, Created, Completed, Expires, Has
file — with checkboxes, drag handles, "Reset to default", and Apply.

TABLE — one run per row
[checkbox] | Source chip ("Report run" / "Export job") | Report (human title in Accent Indigo
with the definition key in 10px monospace beneath, plus a Muted "Contains personal data" chip
where applicable) | Status pill, with a thin determinate Accent Indigo progress bar beneath any
Running row | Format chip (CSV / XLSX / JSON, or an em dash where not yet known) | Rows
(monospace right-aligned, or an em dash while running) | Requested by (name over a relative
timestamp) | Created (absolute in monospace with a relative caption) | Completed (absolute, or
the elapsed time so far for a running row) | Expires (per the addendum's expiry rule) | File (the
single resolved affordance from the addendum — Download with size, Restricted, File removed with
Re-run, Retry with the truncated error, or nothing at all) | kebab (Open run detail, Download,
Re-run with the same parameters, Copy run ID, Copy definition key, Delete file, Cancel run).
Sortable on Created, Completed, Rows, Expires; active sort = Created descending. Show 14 rows
covering every combination: two Running with progress bars, one Queued, eight Succeeded across
all three file states, two Failed with different errors, and one Cancelled.

SELECTION BAR (render visible): "6 exports selected · 4 with files · 18.4 MB" with "Download as
ZIP", "Delete files", "Re-run", "Clear".

FOOTER: "Showing 1–50 of 1,284 exports", page-size select, paginator, and a Muted Ink caption:
"Run records are kept for audit even after their files are removed."

ALSO PRODUCE as separate frames:
A. Loading — skeleton summary band and rows matching exact column widths.
B. Empty — line-art mark of a tray with a downward arrow, heading "No exports in this range",
   sentence "Exports you run from any report appear here.", primary "New export".
C. Error — inline Danger strip "Couldn't load export history." with Retry.
D. Mobile 390px — summary band as a two-up grid, filter bar collapses to a search field plus a
   "Filters (3)" button opening a bottom sheet, each export a card with report name, source
   chip, status pill, requester, created date, and the single file affordance as a full-width
   button.
```

---

## Screen 2 — `/admin/reports/exports/[runId]`

```text
Screen: Export run detail. Route /admin/reports/exports/[runId]. Back text-link "All exports".
Produce three variants: a succeeded run with a live file, a failed run, and a running run.

HEADER
Breadcrumb: Admin / Reports / Exports / payments-transactions-2026-08-04.csv. Title: the file
name in 20px monospace with a copy icon, or — where no file exists — the report title with the
run ID as the subtitle. Beneath: a chip cluster carrying the source chip, the report title
linking to that report, the definition key in monospace, the format chip, and a "Contains
personal data" chip where applicable. Right: secondary "Copy run ID", secondary "Re-run with the
same parameters", destructive-outline "Delete file", primary "Download (4.2 MB)" — the primary
resolving per the addendum's affordance rule, so the failed variant leads with "Retry" and the
running variant leads with "Cancel run".

STATUS BAND (unequal cells, first double width)
"Succeeded" as a large status pill beside the elapsed duration "Completed in 42s" at 28px
monospace, with the caption "Queued 14:38:02 · Started 14:38:04 · Completed 14:38:46" in
monospace. Then: "Rows 1,284" | "File size 4.2 MB" | "Format CSV" | "Expires in 6 days" with the
absolute date beneath and a Warning tint within 48 hours.
The running variant replaces the first cell with a determinate progress bar, "Running · 62%",
and a caption "1,204 of about 1,940 rows · started 38s ago". The failed variant replaces it with
a Danger pill and the failure time.

PIPELINE TIMELINE — a slim full-width panel: a horizontal sequence of stages — Queued →
Started → Query → Serialize → Upload → Delivered — each a node with its timestamp in monospace
beneath, completed stages filled Accent Indigo, the current stage hollow with a pulse on its
node only, and any failed stage marked Danger with the stage name that broke. Skipped stages
(delivery, where none was configured) render Muted with a "Not configured" caption.

PARAMETERS PANEL — the audit heart of the screen: a two-column label/value block giving exactly
what was asked for — report definition with its key, the filters applied rendered as readable
chips ("Status is Paid", "Gateway is Razorpay", "Paid between 1 Jul and 4 Aug 2026"), the column
list as a wrapping chip row with a count ("13 columns"), the sort, the row limit, the requested
format, and the delivery target. Beneath, a collapsed "Raw parameters" Sunken Surface JSON block
with a copy button, expanded to six lines by default with a "Show all" toggle.

FAILURE PANEL — shown only on the failed variant, directly beneath the status band: a
Danger-tinted panel with the error class in monospace, the full message wrapping, the stage it
failed at, and a plain-language explanation where the error is recognised ("The query exceeded
the 60-second limit. Narrow the date range or reduce the column count."). Two buttons: "Retry"
and "Retry with a narrower range" which opens the creation flow prefilled.

DELIVERY PANEL — label/value rows: destination (a chip: Download only, Email, Webhook, Storage
bucket), recipients as chips, delivered-at, delivery status pill, and — for failed delivery — an
inline "Resend" text button with the transport error beneath.

ACCESS LOG — a compact table, the compliance record: who downloaded this file and when.
Admin (avatar chip + name over email) | Action chip (Downloaded / Link opened / Delivered by
email) | IP address in monospace | Timestamp (relative + absolute). Show 4 rows, plus an empty
variant reading "No one has downloaded this file yet."

ALSO PRODUCE: the "Delete file" modal — names the file, its size, its report, and its expiry,
states plainly that the run record and its parameters are kept for audit while the file itself
is removed permanently, requires no reason but does require an explicit confirm, then Cancel and
a solid Danger "Delete file"; a loading skeleton; and a 390px mobile frame where the parameters
panel becomes a single column and the pipeline timeline runs vertically.
```

---

## Screen 3 — `/admin/reports/exports/new`

```text
Screen: New export. Route /admin/reports/exports/new. A focused full-page flow, single centred
column at 900px, with the module tab strip still visible and a "Cancel" text link top-right.
This is the one place in the console where an export can be built against any report, so it must
teach as it goes.

STRUCTURE — five numbered sections stacked vertically with hairline separators, each with a
short title and a one-line explanation. A slim sticky summary rail docks right at 300px above
1200px, restating the running configuration and the estimated size.

1. REPORT — a searchable grid of the sixteen definitions rendered as selectable rows, not cards:
   each row shows the human title, the definition key in 10px monospace, a one-line description
   of what it contains, and a Muted "Contains personal data" chip where applicable. Grouped
   under hairline headers by theme — Learners, Commerce, Live, Operations. Once chosen, the
   section collapses to the selected row with a "Change" text button.
2. SCOPE — the filter builder for the chosen report, rendered as condition rows (field →
   operator → value) using that report's own real filter fields, plus a date-range picker and a
   row-limit input with a caption naming the maximum. A "Use the filters from a saved view"
   combobox sits above, and a live caption beneath reads "About 1,284 rows match" with a
   "Preview 10 rows" text button that expands an inline sample table.
3. COLUMNS — a two-column checkbox list of that report's real columns with "Select all" and a
   running caption "13 of 14 columns selected", drag handles for output order, and a Warning
   caption pinned beside any group containing personal data ("Email, IP address, and billing
   address are personal data"). An "Empty values" radio: "Leave blank" / "Write a placeholder"
   revealing a text input.
4. FORMAT — a segmented control (CSV / XLSX / JSON) with a one-line trade-off caption under each
   ("CSV for spreadsheets and imports", "XLSX keeps column types and formatting", "JSON for
   pipelines"), plus format-specific options that appear inline: delimiter and encoding for CSV,
   a "One sheet per group" toggle for XLSX, a "Nested or flat" radio for JSON.
5. DELIVERY — a radio set: "Download when ready" (default) / "Email me when ready" / "Send to a
   destination", the last revealing a destination combobox that lists configured destinations
   with their type chips and an "Add a destination" link. Choosing an external destination
   reveals a Warning acknowledgement checkbox: "This sends personal data outside the console to
   <destination name>" which must be ticked before the submit enables. Beneath, a "Schedule this
   export" toggle revealing cadence, time, timezone, and a "Name this schedule" field.

STICKY SUMMARY RAIL: report title with its key, the filter summary as chips, column count,
format, delivery target, estimated rows and file size, and a caption on file retention ("Files
are removed after 7 days"). Footer of the rail: a primary "Run export" button disabled until the
required steps are complete, plus a "Save as a schedule only" text button.

ALSO PRODUCE: the running state — the whole form replaced by a centred panel with the pipeline
timeline from Screen 2, a determinate progress bar, the parameters restated beneath, and two
buttons "Run in the background" and "Cancel"; the ready state — the same panel with a Success
pill, the file name in monospace, its size and row count, and a primary "Download" plus a "New
export" secondary; the failed state with the failure panel from Screen 2; and a 390px mobile
frame where the summary rail becomes a sticky bottom bar reading "1,284 rows · CSV · Download".
```

---

## Screen 4 — `/admin/reports/exports/schedules`

```text
Screen: Scheduled exports. Route /admin/reports/exports/schedules. Module tab active on
"Schedules".

HEADER
Title "Schedules", subtitle "Exports that run on a cadence and deliver themselves." Right:
secondary "Export this list", primary "New schedule".

SUMMARY BAND (unequal cells, first double width): "Schedules 14" at 32px monospace with the
caption "11 enabled · 3 paused" | "Runs this month 62" with the caption "58 succeeded · 4
failed" | "Next run in 3 hours" with the schedule name beneath | "Failing schedules 2" in Danger
with the caption "3 consecutive failures", clickable to filter | "Delivering externally 6" in
Warning with the caption "to email or webhook".

FILTER BAR
Search ("Search schedule name or report"), "Report" combobox with the sixteen definitions,
"Status" select (Enabled, Paused, Failing, All), "Cadence" select (Daily, Weekly, Monthly,
Custom), "Destination" select (Download only, Email, Webhook, Storage bucket), "Owner" combobox,
and a sort select (Next run ↑, Last run ↓, Name A–Z, Failures ↓). Chips beneath with "Clear
all".

TABLE — one schedule per row
[checkbox] | Schedule (name in Accent Indigo, with the report title and its definition key in
10px monospace beneath) | Cadence (a plain sentence in monospace, "Every Monday, 07:00
Asia/Kolkata", with the next run as a relative caption) | Destination (a chip per target — an
email chip showing the recipient count, a webhook chip showing the host — plus a Warning
"External" marker where data leaves the console) | Format chip | Last run (status pill with a
relative timestamp and the row count beneath; failing schedules carry a Danger left rail and a
"3 consecutive failures" caption) | Next run (absolute in monospace with a relative caption; a
Muted "Paused" where disabled) | Owner | Enabled (an inline toggle whose change opens a
confirmation naming the schedule) | kebab (Open schedule, Run now, Edit, Duplicate, View run
history, Pause, Delete). Sorted by next run ascending. Show 10 rows including two failing, three
paused at reduced emphasis, and two delivering externally.

SELECTION BAR: "3 schedules selected" with "Run now", "Pause", "Delete", "Clear".

ALSO PRODUCE: loading skeleton; empty state — line-art mark of a clock over a tray, heading "No
scheduled exports", sentence "Turn any export into a recurring one from the export builder.",
primary "New schedule"; the delete-confirmation modal naming the schedule, its cadence, its
destination, and how many past runs it produced (with a note that past runs and their files are
kept); inline error strip; and a 390px mobile frame where each schedule is a card with the
cadence line and destination chips stacked.
```

---

## Screen 5 — `/admin/reports/exports/schedules/[scheduleId]`

```text
Screen: Schedule detail. Route /admin/reports/exports/schedules/[scheduleId]. Back text-link
"All schedules".

HEADER
Breadcrumb down to the schedule. Title: the schedule name, with the report title and its
definition key beneath in monospace, and a chip cluster: enabled state, cadence, format,
destination type. Right: secondary "Run now", secondary "Edit", secondary "Duplicate",
destructive-outline "Delete schedule", and an enabled toggle rendered as a labelled control
rather than a bare switch.

HEADLINE BAND (unequal cells, first double width): "Next run in 3 hours" at 32px monospace with
the absolute timestamp and timezone beneath | "Runs 62" with the caption "58 succeeded · 4
failed" | "Success rate 93.5%" with a 3px bar | "Average duration 1m 12s" | "Average rows 1,284"
with a small sparkline of row counts over the last 12 runs, so a sudden drop is visible.

CONFIGURATION PANEL — a read-only rendering of exactly what the schedule runs, in two columns:
report and key, filters as readable chips, columns as a wrapping chip row with a count, format
with its options, row limit, cadence with timezone, and retention. Each group has a small "Edit"
text button that opens the builder at that step. A Warning strip sits above this panel whenever
the schedule delivers externally: "This schedule sends personal data to
finance@example.com and one webhook on every run."

RUN HISTORY — the main table: Run (file name in monospace linking to the run detail, or the run
ID where no file exists) | Status pill | Rows (monospace, with a delta caption against the
previous run where it moved sharply) | Duration | Started (absolute + relative) | Delivery
(status pill per destination, stacked where there are several) | File (the single resolved
affordance from the addendum) | kebab. Show 10 rows including two failures with different
errors and one where the export succeeded but delivery failed — that row's status is Succeeded
while its delivery pill is Danger, and a caption spells out the distinction.

TROUBLE PANEL — shown only when the schedule is failing: a Danger-tinted panel naming the
consecutive failure count, the first line of the most recent error, when it started failing, and
two actions — "Open the failing run" and "Pause this schedule". A caption states whether the
schedule will keep retrying and when it will stop.

ALSO PRODUCE: loading skeleton; the never-run variant where the run history is replaced by "This
schedule has not run yet" with the next run time and a "Run now" button; the delete modal; and a
390px mobile frame where the configuration panel becomes one column.
```

---

## Screen 6 — `/admin/reports/exports/destinations`

```text
Screen: Delivery destinations. Route /admin/reports/exports/destinations. Module tab active on
"Destinations". Where exported data is allowed to go.

HEADER
Title "Destinations", subtitle "Where scheduled and delivered exports are sent." Right:
secondary "Export this list", primary "New destination".

SUMMARY BAND (unequal cells, first double width): "Destinations 8" at 32px monospace with the
caption "5 email · 2 webhook · 1 storage bucket" | "Deliveries this month 62" with "60
succeeded" | "Failing 1" in Danger with the caption "webhook returning 500", clickable |
"External recipients 14" in Warning with the caption "addresses outside your tenant domain" |
"Last delivery 2 hours ago".

LIST — one full-width Panel Surface block per destination rather than a dense table, because
each carries different fields:
LEFT of the block — identity: the destination name at 15px/600, a type chip (Email / Webhook /
Storage bucket), and the target rendered per type — email destinations show recipient chips with
any address outside the tenant domain carrying a Warning marker; webhook destinations show the
URL host in monospace with the path truncated and a copy icon, plus the signing secret masked
with a reveal toggle; storage destinations show the bucket and prefix in monospace.
RIGHT of the block — health: a delivery status pill, "Last delivered 2 hours ago", a 30-day
strip of one small square per day tinted by delivery outcome, the count of schedules using it,
and a kebab (Edit, Send a test, View deliveries, Disable, Delete). Blocks for failing
destinations carry a Danger left rail and an inline error line.
Show 5 blocks covering all three types, including one failing webhook and one disabled email
destination at reduced emphasis.

NEW DESTINATION DRAWER — produce as its own frame: a type segmented control (Email / Webhook /
Storage bucket) that swaps the form beneath. Email: a name field, an email chips input with
inline validation, and a Warning caption that appears the moment an address outside the tenant
domain is added ("priya@gmail.com is outside example.com — exports sent here leave your
organisation"). Webhook: a name, a URL field with an https-only caption, a signing-secret field
with a "Generate" button, a retry-policy select, and a payload-format radio (Multipart file /
JSON with a signed URL). Storage bucket: a name, provider select, bucket, prefix, and a
credentials block that states plainly that credentials are stored encrypted and shown masked
after saving. All three end with a "Send a test delivery" secondary button whose result renders
inline as a success line or the raw transport error, and a footer primary "Create destination".

ALSO PRODUCE: loading skeleton; empty state — line-art mark of an arrow leaving a box, heading
"No destinations configured", sentence "Exports can still be downloaded directly. Add a
destination to deliver them automatically.", primary "New destination"; the delete modal naming
the destination and the schedules that use it, warning that those schedules will fall back to
download-only; and a 390px mobile frame where each block stacks its two sides.
```

---

## Screen 7 — `/admin/reports/exports/settings`

```text
Screen: Export settings. Route /admin/reports/exports/settings. Module tab active on "Settings".
Retention and governance for everything this module produces.

HEADER
Title "Settings", subtitle "How long export files are kept, who may run them, and what leaves
the console." Right: secondary "View audit log", primary "Save changes" — disabled until a field
changes, with an unsaved-changes caption in Warning beside it when dirty.

SECTION 1 — RETENTION, a Panel Surface form:
- "Keep export files for" a numeric stepper with a unit select (days / hours), default 7 days,
  helper "After this, the file is deleted. The run record and its parameters are kept for
  audit." A live caption beneath reads "218 files currently stored · 4.8 GB · 64 expire in the
  next 48 hours."
- "Keep run records for" a select (1 year / 2 years / 5 years / Forever), default 2 years, with
  a caption noting that records without files are small.
- "Maximum rows per export" a numeric field with a caption on what happens when it is exceeded.
- "Maximum concurrent exports per admin" a numeric stepper.
- A "Delete expired files now" secondary button beside a caption naming how many would go and
  how much space it frees, behind a confirmation.

SECTION 2 — ACCESS, laid out as full-width toggle rows with helper text beneath each:
- "Who can run exports" a role multi-select showing the tenant's roles as chips.
- "Who can download files they did not request" a radio: "Anyone who can run exports" /
  "Owners only" / "The requester only", with a caption explaining the effect on the ledger's
  Restricted state.
- "Require a reason for exports containing personal data" toggle, off, with a caption that the
  reason is stored on the run record and appears in the audit log.
- "Allow delivery to destinations outside this tenant" toggle, on, with a Warning caption
  naming how many destinations that currently permits.
- "Watermark exported files with the requester's name" toggle, off, with a caption on which
  formats support it.

SECTION 3 — PERSONAL DATA, a compact table rather than a form: one row per column group the
system recognises as personal — Learner name, Email, Phone, Billing address, Tax ID, IP address,
Device fingerprint — each with the reports that expose it as chips, a "Treatment" select
(Include / Mask / Exclude) defaulting to Include, and a caption on what masking looks like in
output ("p•••@example.com"). A closing Muted Ink line states that changing a treatment affects
future exports only.

SECTION 4 — AUDIT, a preview: the last 8 governance events as a timeline — retention changed
from 14 to 7 days by Nandita Rao; external delivery enabled; a file deleted manually; the
personal-data treatment for IP address set to Mask — each with a monospace timestamp and the
admin name, plus a "View full audit log" link.

ALSO PRODUCE: the leave-with-unsaved-changes modal; a confirmation modal for the retention
reduction specifically, naming how many currently stored files would be deleted immediately by
the new setting and requiring an explicit confirm; a loading skeleton; and a 390px mobile frame
where the personal-data table becomes stacked cards.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature                                                                                                                                 | Status                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Export history list unifying `report_run` and `export_job` rows                                                                                | exists                                                                                 |
| Row fields: source type, definition key and title, status, format, row count, requester, created, completed, expires, `hasFile`, `canDownload` | exists — the three-flag download rule is backed by real fields                         |
| Status enum (QUEUED / RUNNING / SUCCEEDED / FAILED / CANCELLED)                                                                                | exists                                                                                 |
| Summary object (total, succeeded, failed, pending)                                                                                             | exists — the summary band is backed                                                    |
| Filters: source type, status, definition key, created range, free-text search; column picker                                                   | exists                                                                                 |
| CSV export of the export history itself                                                                                                        | exists                                                                                 |
| Run detail endpoint (`/api/v1/reports/runs/[runId]`)                                                                                           | exists — verify exactly which fields it returns before building Screen 2               |
| File size per run                                                                                                                              | not in the DTO — check whether the storage layer records it                            |
| Pipeline stage timeline, per-stage timestamps, progress percentage for running rows                                                            | needs backend                                                                          |
| Stored run parameters (filters, columns, sort, limit) surfaced for audit and re-run                                                            | needs backend                                                                          |
| Re-run with the same parameters, retry, cancel a running run, delete a file                                                                    | needs backend — the ledger is read-only today                                          |
| Download access log (who downloaded, when, from where)                                                                                         | needs backend                                                                          |
| The whole export builder (Screen 3) as a cross-report flow                                                                                     | each report has its own export endpoint; a generic builder needs a unified entry point |
| Schedules, schedule run history, run-now, pause                                                                                                | needs backend — no scheduling exists anywhere in the codebase                          |
| Destinations (email, webhook, storage bucket), test delivery, delivery status                                                                  | needs backend                                                                          |
| Retention, access rules, personal-data treatments, watermarking, governance audit log                                                          | needs backend                                                                          |
| Saved views                                                                                                                                    | needs backend                                                                          |

One naming note for whoever builds this: the module's own definition key is `exports`, so the
ledger contains rows describing exports of itself. That is correct and should not be filtered
out — but Screen 1's copy deliberately avoids drawing attention to it.
