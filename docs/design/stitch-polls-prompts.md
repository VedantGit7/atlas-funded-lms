# Google Stitch Prompts — Polls (`/admin/reports/polls`)

Paste **Block 0 (Design System)** first, then **Block 0-PL (Polls addendum)**, then one screen
prompt per generation. Keep everything in one Stitch project.

Block 0 is identical to the one in the Active Devices, Payments, Progress & Score, and Batches
files; reproduced here so this file stands alone.

Source of truth:
- `frontend/apps/web/src/features/admin/reports/AdminPollsRosterPage.tsx`
- `frontend/apps/web/src/features/admin/reports/admin-polls-roster-api.ts`
- `backend/packages/domain/src/polls/polls.dto.ts` (enums)
- `backend/apps/api/src/app/api/v1/reports/polls/*`

Today the module is one page with a two-level drill in local state: poll list → poll detail
holding an option breakdown plus a respondent table that hides itself for anonymous polls.

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
- Success            #15803D / #62DF7D   — correct answer, healthy participation
- Warning            #B45309 / #E6C364   — low participation, closing soon, pending
- Danger             #DC2626 / #FF8A80   — incorrect answer, failed, destructive confirm
Every screen must render correctly in BOTH themes. Use the token name, not a one-off hex.

TYPOGRAPHY
- UI + headings: Plus Jakarta Sans. Page title 24px/600 tracking -0.01em. Section title
  16px/600. Table header 12px/600 uppercase tracking 0.06em in Muted Ink. Body 14px/400.
  Metadata 12px/400 Muted Ink.
- All numerals, percentages, durations, counts, IDs, timestamps: JetBrains Mono.
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
- Every action that messages learners or changes their records opens a confirmation that names
  the exact recipient count and states the consequence in plain words.

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

## Block 0-PL — Polls addendum (paste second)

```text
POLLS MODULE ADDENDUM — applies to every screen in /admin/reports/polls

WHAT A POLL IS
A poll is a question with fixed options, either standalone or attached to a live session. It
can be a plain opinion poll or a quiz poll where one or more options are marked correct.
Voting can be anonymous or identified. Results can be revealed after each vote or only after
the poll closes.

ANONYMITY IS THE HARD RULE OF THIS MODULE
When a poll is anonymous, individual voter identity does not exist in the report — not
hidden behind a permission, not blurred, not revealable. Every screen must:
  - show an "Anonymous" pill beside the poll title, in Muted Ink with a lock-free plain label;
  - replace any respondent table with a Sunken Surface explainer panel reading "Voter identity
    is not recorded for this poll. Option tallies below remain available.";
  - keep every aggregate view (tallies, timing, participation counts) fully functional;
  - never render a disabled or greyed respondent table, and never show a "Reveal identities"
    control of any kind.
Design the identified and anonymous variants of every screen that touches respondents.

POLL ATTRIBUTES (real enums — use these exact labels)
- Type: Multiple choice · Yes / No
- Status: Active · Inactive · Archived
- Answer mode: Single answer · Multi-answer
- Quiz mode: on (correct options are marked) or off
- Privacy: Identified · Anonymous
- Result visibility: After vote · After poll ends
- Layout: List · Grid · Card
- Duration: a countdown in seconds, or "No time limit"
Render these as a compact chip cluster under the poll title, in this order, omitting any that
do not apply. Never invent attributes outside this set.

OPTION BAR (the signature component of this module)
An option renders as a full-width row: the option label at 14px/500 on the left; a horizontal
bar filling the row's width proportional to its share, in Accent Indigo — the leading option
in the full accent, the rest at 60% tint; and on the right the vote count and percentage in
monospace ("47" then "38.5%"). In quiz mode the correct option's bar is Success and carries a
"Correct" label; a wrong option chosen by more learners than the correct one carries a Warning
caption "Chosen more than the correct answer". Bars are always horizontal — never a pie,
donut, or 3D chart, at any size.

PARTICIPATION
Where the audience size is known (a live session roster or a linked batch), always show
participation as "responded of eligible": "124 of 186 · 66.7%" with a 3px bar, plus a
"Non-respondents 62" figure that links to the non-respondent list. Where the audience is
unknown, show the raw response count and the caption "Audience size unknown for standalone
polls" — never fabricate a denominator.

DATA REALISM
Poll titles like "Which risk model do you use most?", "Was the position sizing example clear?",
"Pick the correct stop distance". Options like "Fixed fractional", "Volatility-based",
"Fixed dollar", "I don't use one". Live sessions like "Week 6 — Position sizing live".
Learner names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo", "Wei-Lin Chua".
Counts like 47, 124, 186. Percentages like 38.5%, 66.7%, 12.1%.
```

---

## Screen 1 — `/admin/reports/polls` (poll list)

```text
Screen: Polls — report index. Route /admin/reports/polls. Desktop 1440px, admin sidebar with
"Reports" expanded and "Polls" active.

HEADER
Breadcrumb: Admin / Reports / Polls. Title "Polls", subtitle "Live and standalone poll
results, option tallies, and respondent detail where voting is identified." Right side: a
secondary "Compare polls" button, a secondary "Export" button, and a primary "Manage polls"
button linking to the poll authoring screen.

MODULE TAB STRIP (shared by every screen in this module, under the header)
Polls · Live sessions · Compare · Exports. Underline tabs, active in Accent Indigo.

SIGNAL BAND (unequal cells, first is double width)
"Responses collected" — 4,182 in 32px monospace with a caption "across 96 polls" and a thin
Accent Indigo bar strip behind the lower third showing responses per week. Then: "Average
participation 66.7%" with a 3px bar and a caption "where audience size is known" | "Quiz polls
34" with a caption "average 71.4% correct" | "Open now 3" in Success, clickable to filter |
"Anonymous polls 21" with the caption "no respondent detail".

FILTER BAR
Search input ("Search poll title or description"), "Type" select (All, Multiple choice,
Yes / No), "Status" select (Active, Inactive, Archived, All), "Mode" multi-select (Quiz mode,
Multi-answer, Anonymous, Timed), "Source" select (All, Live session, Standalone), "Live
session" combobox, "Created" date range, and a "Sort" select (Responses ↓, Participation ↑,
Created ↓, Title A–Z). Applied-filter chips beneath with "Clear all" and "Save as view".
Saved-view tabs above the table: "All polls" (active), "Open now", "Quiz polls", "Low
participation", "Anonymous", "+ New view".

TABLE — one poll per row
[checkbox] | Poll (title in Accent Indigo at 14px/500, and beneath it the attribute chip
cluster in 11px: type, answer mode, quiz mode, privacy, result visibility, and option count) |
Source (the live session title as a link, or "Standalone" in Muted Ink) | Responses (monospace
count) | Participation ("124 of 186" in monospace with a 3px bar beneath and the percentage;
Warning tint below 40%; where the audience is unknown, an em dash with the caption "Audience
unknown") | Leading option (the option label truncated to one line, with its share in monospace
beneath; in quiz mode a Success or Danger tint shows whether the leader is the correct answer)
| Correct rate (monospace percentage for quiz polls, an em dash otherwise) | Closes (a
countdown "Closes in 4m 12s" in Warning for an open poll, an absolute timestamp for a closed
one, or "No time limit") | Created | kebab (Open report, View respondents, Export poll,
Duplicate poll, Open in poll editor, Archive). Rows click through to the poll report. Sortable
headers on Responses, Participation, Correct rate, Created; active sort = Created descending.
Show 12 rows mixing every combination: two anonymous polls (their Leading option cell still
populated, since tallies are never hidden), three quiz polls including one where a wrong option
leads, two live-session polls, one open poll with a live countdown, and one archived poll at
reduced emphasis.

SELECTION BAR (render visible): "4 polls selected" with "Compare", "Export selection",
"Archive", "Clear".

FOOTER: "Showing 1–25 of 96 polls", page-size select, paginator, and a caption in Muted Ink:
"Participation is shown only where the poll has a known audience — a live session roster or a
linked batch."

ALSO PRODUCE as separate frames:
A. Loading — skeleton signal band and skeleton rows matching exact column widths.
B. Empty — line-art mark of three stacked option bars, heading "No polls match these filters",
   sentence "Polls are created in Products → Poll, or launched during a live session.",
   primary "Manage polls".
C. Error — inline Danger strip "Couldn't load polls." with Retry.
D. Mobile 390px — signal band as a two-up grid; each poll a card with the title, the chip
   cluster wrapping to two rows, the leading option bar full width, and the response count.
```

---

## Screen 2 — `/admin/reports/polls/[pollId]` (poll report)

```text
Screen: Poll report. Route /admin/reports/polls/[pollId]. Back text-link "All polls".
Produce TWO full variants of this screen: an identified poll and an anonymous poll.

HEADER
Breadcrumb: Admin / Reports / Polls / Which risk model do you use most?. Title: the poll
question at 24px/600, wrapping to at most two lines. Beneath it the description in Muted Ink,
then the attribute chip cluster: "Multiple choice", "Single answer", "Quiz mode", "Identified"
(or "Anonymous"), "Results after vote", "4 options", "60s". Right: secondary "Columns",
secondary "Export CSV", secondary "Open in poll editor", primary "Message respondents"
(replaced by "Message non-respondents" on the anonymous variant, since individuals who voted
cannot be addressed).

SUMMARY BAND (unequal cells, first double width)
"Responses 124" at 32px monospace with the participation caption "of 186 eligible · 66.7%" and
a 3px bar. Then: "Correct 71.4%" in quiz mode with a bar and the caption "89 of 124 answered
correctly" (omit entirely for non-quiz polls rather than showing an em dash cell) | "Median
time to answer 8.4s" | "Source: Week 6 — Position sizing live" as a link, or "Standalone" |
"Closed 22 Jul 2026, 19:24 IST".

RESULTS PANEL — the primary object, full content width:
the option bars stacked in the poll's own option order, each row exactly as specified in the
addendum: label, proportional horizontal bar, count and percentage in monospace on the right.
In quiz mode the correct option's bar is Success with a "Correct" label chip, and any wrong
option that outpolled it carries the Warning caption. Each option row is clickable and filters
the respondent table beneath; the active option shows an Accent Indigo left rail and appears
as a removable chip above the respondent table. A footer line under the bars gives the totals:
"124 responses · 124 learners · 1 answer each" (or "168 answers from 124 learners" for a
multi-answer poll).

RESPONSE TIMELINE — a slim full-width panel beneath the results: a horizontal time axis from
poll open to close with a filled area of responses per 5-second bucket in Accent Indigo, a
vertical marker at the moment the poll closed, and a caption "78% of responses arrived in the
first 20 seconds." For a poll with no time limit, the axis spans first to last response and
the caption reads in days instead.

RESPONDENTS SECTION — IDENTIFIED VARIANT
A filter bar: learner search ("Name or email"), "Option" select listing every option, "Correct"
select (All, Correct, Incorrect) shown only in quiz mode, "Responded from" date, "Responded to"
date, and a sort select (Responded on, Learner, Option) with a direction toggle. Chips beneath
with "Clear all".
COLUMNS POPOVER — produce one frame with it open listing the real column set: Learner, Email,
Option, Correct, Responded on — with checkboxes, drag handles, "Reset to default", Apply.
TABLE: [checkbox] | Learner (avatar chip + name over email in Muted Ink) | Option (the chosen
option label as a chip tinted to match its bar; for multi-answer polls, several chips stacked)
| Correct (a Success check or Danger cross with the word, quiz mode only) | Time to answer
(monospace "6.2s" with a thin bar against the poll duration) | Responded on (relative +
absolute) | kebab (Open member profile, View learner's poll history, Message learner). Show 12
rows spanning every option and both correctness states.
SELECTION BAR: "7 respondents selected" with "Message selected", "Export selection", "Clear".
FOOTER: "Showing 1–25 of 124 respondents", page-size select, paginator.

RESPONDENTS SECTION — ANONYMOUS VARIANT
In place of the filter bar and table, a single Sunken Surface panel with a small line-art mark,
the heading "Responses are anonymous", the sentence "Voter identity is not recorded for this
poll. Option tallies and timing above remain available.", and one secondary button "View
non-respondents" with the caption "Eligibility is known from the live session roster, so who
did not answer can still be listed." No greyed table, no reveal control, no lock iconography.

ALSO PRODUCE: loading skeleton; the no-responses empty state ("No responses recorded for this
poll" with a "Open in poll editor" button); inline error strip; and a 390px mobile frame where
the option bars go full width, the timeline compresses to a sparkline, and respondents become
stacked cards.
```

---

## Screen 3 — `/admin/reports/polls/[pollId]/options/[optionId]`

```text
Screen: Option detail. Route /admin/reports/polls/[pollId]/options/[optionId]. A right-side
drawer over the poll report at 560px, AND a standalone full page for deep links. Produce both.

HEADER
The option label as the title, wrapping to two lines, with a Muted Ink line beneath naming the
parent poll and a "Correct" or "Incorrect" pill in quiz mode. A close x on the drawer version.

SUMMARY
A Sunken Surface block: the vote count at 28px monospace, the share beneath it as "38.5% of
124 responses" with a 3px bar, and a comparison line "Ranked 1 of 4 options · 11 votes ahead
of the next option". In quiz mode on an incorrect option that outpolled the correct one, a
Warning strip reads "More learners chose this than the correct answer — worth revisiting in
the next session."

WHO CHOSE THIS — identified polls: a compact table of respondents who picked this option:
Learner (avatar chip + name over email) | Time to answer (monospace with a bar) | Responded on
(relative + absolute) | a kebab (Open member profile, Message learner). Above the table a small
strip of segment breakdowns where the audience is known: share of this option within each
batch, and within first-time versus repeat attendees, each as a labelled mini bar. Show 10
rows.
Anonymous polls: the same summary block, then the Sunken Surface anonymity explainer in place
of the table, plus the segment breakdown strip only if it can be computed without identifying
anyone — otherwise omit the strip entirely rather than showing empty bars.

TIMING — a slim panel: the response curve for this option overlaid on the poll's overall curve
as a faint Muted Ink area, so an admin can see whether this option was chosen early or late,
with a caption "Chosen later than average — median 11.2s versus 8.4s overall."

STICKY FOOTER (drawer version): secondary "Copy option ID", secondary "Export this option",
primary "Message these respondents" (hidden on anonymous polls).

ALSO PRODUCE: the zero-vote variant — the summary shows "0 votes · 0.0%" and an empty state
reading "No learner chose this option"; a loading skeleton; and a 390px mobile frame where the
drawer becomes a full-screen sheet.
```

---

## Screen 4 — `/admin/reports/polls/[pollId]/non-respondents`

```text
Screen: Non-respondents. Route /admin/reports/polls/[pollId]/non-respondents. Back text-link
"Poll report". This screen works for anonymous polls too — it lists who was eligible and did
not answer, which never identifies how anyone voted.

HEADER
Breadcrumb down to the poll. Title "Non-respondents", subtitle "Learners who were eligible for
this poll and did not answer." A Muted Ink line beneath names the eligibility source: "Audience
from the live session roster — Week 6 — Position sizing live (186 attendees)". Right:
secondary "Export CSV", primary "Message non-respondents".

SUMMARY BAND (unequal cells): "Did not answer 62" at 32px monospace in Warning with the caption
"of 186 eligible · 33.3%" and a 3px bar (double width) | "Attended but silent 54" | "Joined
after the poll closed 8" in Muted Ink with the caption "excluded from nudges by default" |
"Also missed the previous poll 21" | "Average sessions attended 7 of 9".

FILTER BAR
Learner search, "Batch" combobox, "Attendance" select (Attended the session, Joined late, Left
before the poll, Did not attend), "Also missed" select (Any, The previous poll, Two or more
polls), and "Add filter". Chips beneath with "Clear all".

TABLE
[checkbox] | Learner (avatar chip + name over email) | Batch chip | In session at poll time (a
pill: Present / Joined late / Left earlier / Absent) | Watch time at that moment ("38m of 60m"
in monospace with a coverage bar) | Polls answered in this session ("2 of 4" in monospace with
a bar) | Last response (the last poll they did answer, with its timestamp, or "Never responded"
in Warning) | kebab (Open member profile, View learner poll history, Message learner, Exclude
from this list). Rows where the learner was not present at poll time carry a Muted rail and a
caption clarifying they had no opportunity to answer. Sorted with present-but-silent learners
first. Show 12 rows across every presence state.

SELECTION BAR: "38 learners selected" with "Message selected", "Export selection", "Clear".

MESSAGE DRAWER (produce as its own frame): header restating "38 learners did not answer", a
subject field pre-filled "We missed your answer: Which risk model do you use most?", a body
with a merge-tag chip row (learner name, poll question, session title, recording link), a
checkbox "Exclude learners who were not present when the poll ran" that live-updates the count
to "30 learners", a channel checkbox pair (Email, In-app), a "Send a test to myself" text
button, and a footer primary "Send to 30 learners" behind a confirmation restating the count.

ALSO PRODUCE: the unknown-audience variant — where the poll is standalone and has no roster,
the whole screen is replaced by an explainer panel reading "This poll has no known audience, so
non-respondents cannot be listed. Link the poll to a live session or a batch to enable this
view." with a secondary "Open in poll editor". Plus loading skeleton and a 390px mobile frame.
```

---

## Screen 5 — `/admin/reports/polls/[pollId]/live`

```text
Screen: Live poll monitor. Route /admin/reports/polls/[pollId]/live. A presentation-weight
screen an admin or host watches while a poll is open during a live session. Same sidebar and
top bar, but the content runs wider and quieter — fewer controls, larger figures.

HEADER
Breadcrumb down to the poll. Title: the poll question at 28px/600. A "Live" pill in Success
with a slow single pulse on its dot only (no other motion on the page), the linked session
title as a Muted Ink link, and a countdown "Closes in 00:42" at 20px monospace that turns
Warning under 10 seconds. Right: secondary "Present mode" (hides the sidebar and enlarges
everything), secondary "Extend by 30s", destructive-outline "Close poll now".

PARTICIPATION HEADLINE — a single full-width band: "87 of 186 answered" with the number at
44px monospace, a 6px participation bar beneath running the full width, the percentage at the
right end, and a caption "+12 in the last 10 seconds".

LIVE RESULTS — the option bars at double the normal height (bars 16px tall, labels 18px), each
bar animating its width change with a 200ms ease-out only when the underlying value changes —
no perpetual motion, no shimmer. Counts and percentages in 20px monospace on the right. In
quiz mode the correct option is NOT revealed while the poll is open: all bars render in Accent
Indigo and a Muted Ink caption reads "Correct answer hidden until the poll closes." A secondary
"Reveal correct answer" button sits above the bars for the host to trigger deliberately, and
its pressed state switches the correct bar to Success with a "Correct" chip.

SECOND ROW — asymmetric 62/38:
LEFT: "Responses per second" — a slim live area chart over the poll duration so far, Accent
Indigo, with the x-axis fixed to the full duration so the plot fills in from the left.
RIGHT: "Answering now" — a compact ticker list of the most recent 8 responses, each row showing
an avatar chip, the learner name, the option chip, and a monospace elapsed stamp, with new rows
entering from the top with a 150ms fade. On an anonymous poll, this panel is replaced by a
Sunken Surface block reading "Responses are anonymous — only the running tally is shown", and
the panel width is given back to the chart.

ALSO PRODUCE:
A. The closed state of the same screen — countdown replaced by "Closed 19:24:06 · ran for
   60s", the correct answer revealed in quiz mode, the Live pill switched to a Muted "Closed"
   pill, and a primary "Open full report" button.
B. Present mode — sidebar and top bar hidden, question at 40px, bars at 28px tall, participation
   headline at 64px, nothing else on screen.
C. A 390px mobile frame for a host watching on a phone: question, countdown, participation
   headline, and the bars — nothing else.
```

---

## Screen 6 — `/admin/reports/polls/live-sessions/[liveSessionId]`

```text
Screen: Polls in a live session. Route /admin/reports/polls/live-sessions/[liveSessionId].
Module tab active on "Live sessions".

HEADER
Breadcrumb: Admin / Reports / Polls / Live sessions / Week 6 — Position sizing live. Title: the
session title, with a Muted Ink subtitle "22 Jul 2026, 19:00 IST · 60 minutes · 186 attendees ·
hosted by Rajiv Menon". Right: secondary "Export CSV", secondary "Open session", primary
"Message low-engagement attendees".

SUMMARY BAND (unequal cells, first double width): "Polls run 4" at 32px monospace with the
caption "3 opinion · 1 quiz" | "Average participation 61.8%" with a 3px bar | "Most answered
Which risk model do you use most? · 124" | "Least answered Pick the correct stop distance · 78"
in Warning | "Answered every poll 54 learners".

SESSION TIMELINE — a full-width panel: a horizontal axis across the 60-minute session with a
faint concurrent-attendance area behind it, and each poll marked as a labelled vertical band
showing when it opened and closed. Each band carries the poll's participation percentage above
it. Clicking a band scrolls to that poll's block below. A caption reads "Participation fell
with each poll — 74.2% on the first, 41.9% on the last."

POLL BLOCKS — one Panel Surface block per poll, stacked, each with: the question at 16px/600
as a link to the poll report, the attribute chip cluster, a participation line ("124 of 186 ·
66.7%" with a 3px bar), the full option bars, and a right-aligned kebab (Open report, View
respondents, View non-respondents, Export). Quiz blocks additionally show the correct rate and
mark the correct bar in Success. Anonymous blocks carry the "Anonymous" chip and simply omit
any respondent affordance from the kebab — no disabled entries.

CROSS-POLL PARTICIPATION GRID — beneath the blocks: a grid with attendees down the left as a
pinned first column (avatar chip + name) and the session's polls across the top as compact
column headers with the poll time beneath in 10px monospace. Each cell is a filled square where
the learner answered and a hollow Outline square where they did not; in quiz mode the square is
Success or Danger by correctness. A trailing pinned column gives "answered 3 of 4" with a 3px
bar. A trailing pinned row gives each poll's participation rate. Horizontal scroll inside the
container with the column and row pinned, a legend row above. Anonymous polls render their
entire column as a Muted hatched band with the header caption "Anonymous — not tracked per
learner", so the grid stays honest rather than dropping the poll silently.

ALSO PRODUCE: loading skeleton; empty state "No polls were run in this session"; error strip;
and a 390px mobile frame that shows the timeline and poll blocks only, with the grid replaced
by the caption "Open on a larger screen to see the participation grid".
```

---

## Screen 7 — `/admin/reports/polls/compare`

```text
Screen: Compare polls. Route /admin/reports/polls/compare. Module tab active on "Compare".
Built for the case where the same question is asked across sessions or cohorts.

HEADER
Title "Compare polls", subtitle "Put two to four polls side by side — useful when the same
question runs across sessions." Right: secondary "Export comparison", primary "Save
comparison".

SELECTION STRIP
A Sunken Surface strip with up to four slots. Each selected poll renders as a chip carrying the
question truncated to one line, its source (session title or "Standalone"), its date, its
response count, and a colour swatch from a graded Accent Indigo ramp, with an x to remove. An
empty slot is a dashed "Add poll" combobox button whose dropdown groups polls by identical or
similar question text so matching ones are easy to find. Beside the slots: an "Align options
by" select (Option order / Option label — label matching lets polls with the same options in a
different order line up) and a "Show" multi-select (Shares, Counts, Participation, Correct
rate).
A Warning strip appears when the selected polls have mismatched option sets: "These polls do
not share the same options — only participation and response counts can be compared." and the
option comparison collapses to a caption rather than rendering misleading aligned bars.

OPTION COMPARISON — the primary object: one block per option label, and inside each block one
horizontal bar per selected poll in its swatch colour, labelled with the poll's short name, its
share in monospace, and a delta caption against the leftmost poll ("+7.4 points"). Blocks are
ordered by the leftmost poll's option order. This reads as a grouped bar chart built from the
same option-bar component, never as a stacked or clustered chart library default.

METRIC GRID — beneath: rows are metrics, columns are polls. Each cell shows the value in 20px
monospace with a 3px bar scaled against the best in the row and a delta caption. Metric rows:
Responses, Eligible audience, Participation, Median time to answer, Correct rate (quiz polls
only, with an em dash elsewhere), Answered in the first 20 seconds, Non-respondents.

TREND STRIP — when three or more polls with the same question are selected, a single line
chart of each option's share across the polls in chronological order, one thin line per option,
inline legend above, with a caption naming the biggest movement: "Volatility-based rose 14.2
points between March and July."

ALSO PRODUCE: an empty state with two dashed slots and the line "Pick at least two polls to
compare"; the mismatched-options variant showing the Warning strip and the collapsed comparison;
a loading skeleton; and a 390px mobile frame where the option comparison stacks one block per
option with the polls as rows inside it.
```

---

## Screen 8 — `/admin/reports/polls/exports`

```text
Screen: Poll exports. Route /admin/reports/polls/exports. Module tab active on "Exports".

HEADER
Title "Exports", subtitle "Download poll results or schedule recurring delivery." Primary
"New export".

LAYOUT — asymmetric 60/40.
LEFT: "Export history" table — File (monospace name with a format chip CSV / XLSX / JSON) |
Dataset chip (Poll summary / Option tallies / Respondents / Non-respondents) | Scope (a filter
summary, e.g. "Week 6 — Position sizing live · 4 polls") | Rows | Size | Requested by |
Created (relative + absolute) | Status pill (Queued / Building / Ready / Failed / Expired) |
action (Download, or Retry on failure). Show 7 rows covering every status; the Building row
carries a thin determinate Accent Indigo progress bar; the Expired row is dimmed with "Files
are deleted after 7 days". Rows whose dataset is Respondents but whose scope included an
anonymous poll show a small Muted caption "1 anonymous poll excluded".
RIGHT: "Scheduled exports" — stacked cards: name ("Weekly live-session poll digest"), dataset
chip, cadence line ("Every Friday, 18:00 Asia/Kolkata"), recipient chips, format chip, "Next
run in 2 days", an enabled toggle, and a kebab (Edit, Run now, Duplicate, Delete). Two
schedules, one disabled at reduced emphasis, then a dashed "New schedule" tile.

MODAL — "New export": Dataset (segmented: Poll summary / Option tallies / Respondents /
Non-respondents). Scope (a poll multi-select combobox with "All polls in a live session" and
"All polls in a date range" shortcuts, plus a date-range picker). Columns (a two-column
checkbox list; for respondents use the real set — learner, email, option, correct, responded
on — with "Select all" and a Warning caption beside email reading "Contains learner personal
data"). An anonymity notice that appears whenever the Respondents dataset is chosen: a Sunken
Surface line reading "Anonymous polls contribute option tallies only. No identity columns are
produced for them." Filters (a read-only summary of the currently applied report filters with a
"Use current filters" toggle, on). Grouping (optional select: none / by poll / by live session
/ by option, with an "Include per-group subtotals" checkbox). Format (segmented CSV / XLSX /
JSON). Delivery (radio: Download now / Email me when ready / Send to recipients, revealing an
email chips input and an optional webhook URL). A "Schedule this export" toggle revealing
cadence, time, and timezone. Footer: Cancel and a primary "Create export".

ALSO PRODUCE: a ready toast "poll-week6-position-sizing-2026-08-06.csv is ready" with a
Download action; a failed-export popover showing the error reason and Retry; and a mobile frame
where schedule cards stack under the history table.
```

---

## Backend gaps these prompts assume

Full best-in-class versions, as intended. What exists today vs. what needs building:

| Prompt feature | Status |
| --- | --- |
| Poll list with type, status, quiz mode, multi-answer, anonymity, result visibility, layout, duration, live session link, response and option counts | exists |
| Poll detail with total responses and per-option count/percent/correct flag | exists |
| `respondentsHidden` anonymity enforcement | exists — the addendum's hard rule is already the server's behaviour |
| Respondent list with learner, email, option, correct, responded-at; filters by name, option, date range; sort; column picker | exists |
| Async CSV export | exists |
| Participation denominators (eligible audience from a session roster or batch) | needs backend |
| Non-respondent list and presence-at-poll-time | needs backend |
| Response timing — time to answer, response curve, "first 20 seconds" | `responded_at` exists; poll-open timestamp and per-response latency need backend |
| Live monitor (open poll, countdown, streaming tally, reveal-correct control, extend, close now) | needs backend and a realtime channel |
| Session-level poll rollup, cross-poll participation grid | needs backend |
| Poll comparison across sessions, option-label alignment | needs backend |
| Message respondents / non-respondents | no poll-scoped messaging endpoint — the batches and progress reports have one to model it on |
| Saved views, export history, scheduled exports | export runs exist; history UI and scheduling need backend |
| Segment breakdowns on an option (by batch, first-time vs repeat) | needs backend |
