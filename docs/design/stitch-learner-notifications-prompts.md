# Google Stitch Prompts — Notifications (`/notifications`, learner side)

Paste **Block 0-L (Learner Design System)** first, then **Block 0-N (Notifications addendum)**,
then the screen prompt.

**This uses a different design system from the admin prompts.** Every other file in this folder
targets the admin console, which has its own `--admin-*` token set, its own type scale, and an
operator-console density. The learner app is a separate surface: navy brand tokens, tenant- and
learner-overridable colours, a user font-scale multiplier, and a mobile-first shell. Do not paste
the admin Block 0 into a learner Stitch project.

Source of truth:

- `frontend/apps/web/src/app/(learner)/notifications/page.tsx`
- `frontend/apps/web/src/features/notifications/components/LearnerNotificationsClient.tsx`
- `frontend/apps/web/src/features/notifications/notifications-inbox-utils.ts`
- `frontend/apps/web/src/server/notifications/notification.dto.ts`
  (`notificationInboxItemSchema`, list query, mark-read response)
- `frontend/apps/web/src/app/api/v1/me/notifications/*`
- `frontend/apps/web/src/app/globals.css` (learner tokens)
- `frontend/apps/web/src/features/learner/learner-navigation.ts` (shell nav)

**The one thing to understand before designing.** A notification carries only seven fields: id,
title, body, actionPath, read, readAt, createdAt. There is **no type, no category, no severity,
no icon, and no channel** on the record. Category and priority are derived _in the browser_ by
pattern-matching the action path and keyword-matching the title and body. That derivation is real
and shipped, so the design uses it — but it is a heuristic, and the addendum sets rules that keep
it from lying to a learner.

---

## Block 0-L — Learner Design System (paste once, first)

```text
DESIGN SYSTEM — Atlas Funded, Learner App

Product: the learner-facing side of a trading academy LMS. The person reading this is a learner
partway through a course, often on a phone, often between other things. Tone: calm, encouraging,
uncluttered. Confident but never shouty. This is not an operator console — it is somewhere
people come to make progress.

ATMOSPHERE
Density 4 (comfortable, generous whitespace, one clear thing per row). Variance 3 (steady and
predictable — a learner should never have to re-learn the layout). Motion 4 (soft, quick, and
purposeful: things fade and rise, nothing bounces or spins).

COLOR PALETTE (light theme / dark theme) — these are the real tokens
- Background        #FFFFFF / #0A0A0A   — page ground
- Foreground        #0A0A0A / #FAFAFA   — primary text
- Card              #FFFFFF / #171717   — surfaces that sit on the ground
- Card foreground   #0A0A0A / #FAFAFA   — text on cards
- Border            #E5E5E5 / #262626   — 1px dividers and card edges
- Muted             #F5F5F5 / #1A1A1A   — inset and secondary surfaces
- Muted foreground  #737373 / #A3A3A3   — timestamps, captions, secondary copy
- Ring              #224466 / #8899AA   — focus rings
- Brand primary     #224466 (both)      — the navy: primary actions, active states, unread marks
- Brand accent      #8899AA (both)      — the muted slate: secondary emphasis
- Brand header      #112233 (both)      — deepest navy, header and heavy surfaces
- Success           #16A34A / #4ADE80
- Warning           #D97706 / #FBBF24
- Destructive       #DC2626 / #F87171
Radius: 0.5rem as the base; cards and buttons use it, pills use full round.
Every screen must render correctly in BOTH themes using the token name, never a raw hex.

THE PALETTE IS NOT ENTIRELY YOURS
Background and foreground are tenant-overridable, and the learner can set a personal accent and
a font-scale multiplier. So: never hard-code a colour that must contrast with the background,
never rely on a specific accent hue to carry meaning on its own, and never set a fixed pixel
height on anything containing text — a learner running a 1.25 font scale must not see clipping
or overlap. Test every layout mentally at 1.0 and at 1.25.

TYPOGRAPHY
- UI and body: Plus Jakarta Sans. Page title 24px/600. Card title 16px/600. Body 15px/400 with
  relaxed leading. Caption 13px/400 in Muted foreground.
- Display accents: Cormorant Garamond, a serif, used sparingly for large celebratory or
  editorial moments only. It is available on this surface — unlike the admin console, where
  serif is banned — but it never appears in dense lists, controls, or metadata.
- Banned: Inter. All-caps body copy. Any third typeface.

COMPONENTS
- Cards: Card surface, 1px Border, 0.5rem radius, generous internal padding, no drop shadow in
  light theme and no glow in dark. Elevation comes from the border and the ground contrast.
- Buttons: primary is Brand primary fill with white text; secondary is transparent with a 1px
  Border; tertiary is text-only in Brand primary. 44px minimum tap target everywhere, no
  exceptions — this is a phone-first surface.
- Pills and chips: full-round, 12px/500, Muted surface with Foreground text, or a tinted
  status hue at ~12% with solid text in the full hue.
- Inputs: Border at rest, Ring on focus with a visible 2px offset, label above, helper beneath.
- Loading: skeletons that match the real shape — never a spinner in the middle of a page.
- Empty states: a small line-art mark, a warm one-line explanation, and at most one action.
- Errors: an inline card in Destructive tint with a plain sentence and a Retry action. Toasts
  are for things that succeeded, never for things that failed to load.

LAYOUT AND SHELL
A learner shell wraps every page: a top bar with the academy mark, a search entry, and an avatar
menu; a primary navigation that is a left rail on desktop and a bottom bar of four to five
primary destinations on mobile. Content is a single centred column, max-width around 800px for
reading surfaces and 1100px for dashboards, with 20px gutters on mobile and 32px on desktop.
Everything is one column below 768px. Never a horizontal scroll on the page itself.

MOTION
150ms ease-out on hover and press. List items fade and rise 4px on first paint with a 30ms
stagger, capped at the first eight. State changes cross-fade rather than jump. Animate transform
and opacity only. Respect prefers-reduced-motion by dropping to instant.

ACCESSIBILITY IS NOT OPTIONAL HERE
Every interactive element is reachable and operable by keyboard with a visible focus ring. Any
control that changes content announces the change politely. Colour never carries meaning alone —
pair it with a word or a shape. Tap targets stay 44px at every font scale.

BANNED
No emojis in product chrome. No Inter. No pure-black surfaces in light theme. No neon glow. No
gradient buttons. No confetti or celebration animation on routine screens. No fake names (John
Doe, Acme). No round fake numbers. No marketing voice ("Supercharge", "Unleash"). No
notification counts invented for visual balance.
```

---

## Block 0-N — Notifications addendum (paste second)

```text
LEARNER NOTIFICATIONS ADDENDUM — applies to /notifications

WHAT THIS SCREEN IS
A learner's in-app inbox. Every entry is something the platform did or noticed on their behalf,
with a link to the thing it is about. It is read-and-go: the learner scans, taps the one that
matters, and leaves. Design for that thirty-second visit, not for inbox management.

THE RECORD HAS SEVEN FIELDS AND NO MORE
id · title · body · actionPath · read · readAt · createdAt.
There is no type field, no category field, no severity field, no channel field, and no icon
reference. Anything richer on the screen is derived in the browser. Never design a control,
filter, or badge that implies the server knows something it does not — no "type: assignment"
chip, no per-channel indicator on a row, no priority the learner can sort by as if it were
authored.

CATEGORY AND PRIORITY ARE HEURISTICS — TREAT THEM AS HINTS, NOT LABELS
Category is inferred from the action path: paths containing courses, studio, or learning read as
"Courses"; community, discussions, or forum as "Community"; calendar, events, or webinar as
"Events"; settings, profile, billing, account, or subscription as "Account"; anything under
admin as "Admin"; everything else as "General".
Priority is inferred by keyword-matching the title and body: words like renewal, payment, failed,
expired, overdue, suspended read as urgent; words like review, pending, action required, verify,
confirm read as attention-needed; everything else is ordinary.
Because these are guesses:
  - render the category as a quiet Muted chip, never as a bold coloured tag;
  - let priority change only the row's icon and a thin 3px leading rail — never the whole card's
    background, never the title colour, and never a loud "URGENT" badge;
  - never let a heuristic hide anything: an ordinary notification and an urgent one sit in the
    same list in the same time order, differing only in that quiet emphasis;
  - never offer "sort by priority" or "filter by category" as if they were authored fields.
A cheerful message about a course review must not be able to look like a billing emergency.

THE ONLY TWO FILTERS THAT EXIST ARE REAL — KEEP IT TO THOSE
A segmented control with exactly two options, "All" and "Unread", plus a free-text search box
that matches title, body, and derived category. Nothing else. No date pickers, no channel
filters, no starred, no archived.

READING IS ONE-WAY AND HAPPENS BY OPENING
Tapping a notification marks it read and navigates to its action path in one motion. There is no
separate "mark as read" button on a row, no way to mark something unread again, and no
mark-all-read. So:
  - the whole row is one large tap target, and the only affordance on it is the row itself;
  - the unread mark must disappear the instant the row is tapped, before navigation completes,
    so the learner sees their action register;
  - never draw a checkbox, a swipe-to-archive, a delete, or a bulk selection bar — none of it
    exists.
If a design needs an action the API does not have, leave it out rather than drawing it disabled.

UNREAD IS SHOWN BY PRESENCE, NOT BY SHOUTING
An unread row carries a small filled dot in Brand primary at its leading edge and a title at 600
weight. A read row has no dot and a title at 500 weight in slightly softer ink. That is the whole
difference — no coloured backgrounds, no borders, no "NEW" pill. The list must look calm when
everything is unread, because for many learners it usually is.

GROUPED BY DAY, NEWEST FIRST — THESE ARE THE REAL LABELS
Today · Yesterday · then the weekday with month and day, e.g. "Tuesday, Aug 12". Group headers
are small, sticky under the page header while their group is in view, in Muted foreground.
Timestamps inside a row follow the real formatter: relative under an hour ("12 minutes ago"),
relative under a day ("4 hours ago"), "Yesterday at 7:14 PM", then "Aug 12, 7:14 PM".

PAGINATION IS A CURSOR, SO THERE IS NO TOTAL AND NO PAGE NUMBERS
The API returns up to 25 items plus a next cursor and a hasMore flag. There is no total count
anywhere. So: no "1–25 of 312", no page numbers, no jump-to-end. A single "Load more" button
sits at the end of the list, becomes a busy state in place while loading, and disappears when
hasMore is false. Never invent a count for the header, and never render an infinite-scroll
sentinel that hides the fact that more exists.

ERRORS ARE INLINE AND CARRY A REQUEST ID
A failed load or a failed mark-read renders an inline card above the list with a plain sentence
and, where the platform supplied one, a request ID in monospace that the learner can quote to
support. Never a toast for a failure, never a raw status code.

DATA REALISM
Real-sounding titles: "Your Module 3 checkpoint was graded", "Priya replied to your question",
"Week 6 live class starts in an hour", "Your certificate for Funded Trader Foundations is
ready", "Payment for Risk Desk Masterclass could not be processed". Bodies of one or two plain
sentences. Names like "Priya Raghunathan", "Tomás Beltrán", "Ade Okonjo". Course titles like
"Funded Trader Foundations", "Risk Desk Masterclass". Times spread realistically across today,
yesterday, and the last week.
```

---

## Screen — `/notifications`

```text
Screen: Notifications — the learner's in-app inbox. Route /notifications. Design mobile-first at
390px and then desktop at 1280px; produce both, with the mobile frame as the primary.

SHELL
The learner shell wraps the page: on desktop a left navigation rail with the academy mark at the
top and destinations listed (Home, Courses, Roadmap, Practice, Readiness, Progress, Resources,
Newsfeed, Diagnostic, Achievements, Leaderboards, Community, Hall of Fame, Certificates,
Notifications, Search) with "Notifications" active; a top bar carrying a search entry and an
avatar menu. On mobile the rail is replaced by a bottom bar of five primary destinations — Home,
Courses, Practice, Newsfeed, and an avatar — with Notifications reached from the top bar, and the
top bar's notification entry carrying a small filled Brand primary dot when unread items exist
(a dot, never a number, because no unread count exists in the API).

PAGE HEADER
Title "Notifications" at 24px/600. Beneath it, one line in Muted foreground: "Updates from your
courses, community, and account." No count, no "you have N unread" — the API returns no total.
On the right of the header on desktop, a single tertiary text link "Notification settings"
pointing at the preferences screen. On mobile that link sits directly beneath the description,
left-aligned, rather than crowding the title row.

CONTROLS ROW — a sticky strip beneath the header, Card surface with a bottom Border, holding
exactly two things:
  - a two-option segmented control, "All" and "Unread", with "All" selected; the selected option
    is a Brand primary fill with white text, the other is plain;
  - a search input with a leading magnifier and the placeholder "Search notifications", full
    width on mobile and 280px on desktop, clearing via a small x when it has content.
Nothing else lives in this strip. When "Unread" is selected, a small Muted-foreground caption
appears under the strip reading "Showing unread only".

THE LIST — grouped by day, newest first
A sticky day header sits above each group: "Today", then "Yesterday", then "Tuesday, Aug 12",
each at 13px/600 in Muted foreground with generous space above and a hairline beneath, sticking
under the controls strip while its group is on screen.

Each notification is a single full-width row, tappable across its whole area, laid out as:
  - a 3px leading rail that is invisible for ordinary items, Warning-tinted for attention items,
    and Destructive-tinted for urgent items;
  - a 40px circular icon holder on the left, Muted surface, containing a line icon chosen by the
    derivation rules — a graduation cap for course paths, people for community, a calendar for
    events, a shield for admin, a cog for account, a bell for anything general, and a filled
    triangle-alert for anything the keyword rules flagged as attention or urgent;
  - the title on one line at 15px, weight 600 when unread and 500 when read, truncating to two
    lines maximum;
  - the body beneath at 14px in Muted foreground, truncated to two lines;
  - a metadata line beneath that: the derived category as a small Muted pill, then a middot, then
    the timestamp in the real format ("12 minutes ago", "4 hours ago", "Yesterday at 7:14 PM",
    "Aug 12, 7:14 PM");
  - a small filled Brand primary dot at the row's trailing edge, vertically centred, present only
    when unread;
  - a faint chevron at the far right on desktop only, hinting that the row navigates.
Rows separate with a 1px Border and use a Muted background on hover and press. There are no
checkboxes, no per-row menus, and no swipe actions anywhere.

Render 9 rows across three day groups, deliberately mixed:
  Today — "Week 6 live class starts in an hour" (events icon, unread), "Priya Raghunathan replied
  to your question" (community icon, unread), "Your Module 3 checkpoint was graded" (courses icon,
  unread).
  Yesterday — "Payment for Risk Desk Masterclass could not be processed" (alert icon, Destructive
  rail, unread — and note in the design that its title is the same weight and colour as every
  other title, only the rail and icon differ), "Please review your profile details before the
  next intake" (alert icon, Warning rail, read), "Your certificate for Funded Trader Foundations
  is ready" (courses icon, read).
  Tuesday, Aug 12 — "New resource added to Prop Firm Bootcamp" (courses icon, read), "Tomás
  Beltrán mentioned you in Risk Desk discussion" (community icon, read), "Your weekly progress
  summary is available" (bell icon, read).

END OF LIST
A single "Load more" secondary button, full width on mobile and auto-width centred on desktop,
with a busy state that replaces its label with "Loading…" in place and keeps its size. When there
is nothing further, the button is absent entirely and a single Muted-foreground line reads
"You're all caught up" — no count, no pagination summary.

ALSO PRODUCE, as separate frames:
A. Unread filter active — the same list scoped to unread only, the segmented control showing
   "Unread" selected, the caption beneath the strip visible, and three rows remaining under a
   single "Today" group.
B. Search active — the search input holding "certificate", one matching row shown under its day
   group, and a Muted-foreground line above the result reading "1 result for “certificate”" with
   a "Clear search" text button.
C. Search with no matches — the input holding "invoice", the list replaced by a compact centred
   block: a small line-art magnifier, "No notifications match “invoice”", and a "Clear search"
   secondary button. The controls strip stays in place.
D. Empty inbox — no notifications at all: a centred block with a small line-art bell, the heading
   "No notifications yet", one warm sentence — "Updates about your courses, community, and
   account will appear here." — and a single tertiary link "Notification settings". The controls
   strip is hidden entirely in this state, because filtering nothing is meaningless.
E. Loading — the header and controls strip present, and six skeleton rows matching the real row
   shape exactly: circle, two text bars of different widths, one short metadata bar. No spinner.
F. Error — the header and controls strip present, and an inline Destructive-tinted card in place
   of the list with the sentence "We couldn't load your notifications." a monospace request ID
   line beneath it, and a "Try again" secondary button.
G. Mark-read failure — the full populated list with an inline Destructive-tinted card sitting
   directly above the first day header, reading "We couldn't mark that as read." with its request
   ID and a "Dismiss" text button; the row the learner tapped still shows its unread dot, because
   nothing changed.
H. Desktop 1280px — the same content in a centred column of about 800px with the navigation rail
   on the left, the "Notification settings" link in the header row, and the chevrons visible at
   the trailing edge of each row.
I. Large font scale — the mobile frame re-rendered at a 1.25 font scale to prove nothing clips:
   titles wrapping to two lines, the metadata line wrapping under the pill rather than
   truncating, tap targets still 44px, and the day headers still legible.
```

---

## The one genuinely adjacent screen

`/profile/notifications` is the real preferences screen and the only other route in this area —
the header's "Notification settings" link points at it. It is worth prompting separately if you
want it, and its shape is already defined in the codebase: per-category rows, each with two
independent toggles for **Email** and **In-app** (the two real channels), grouped by category,
with a dirty-state save and a success toast. Ask and I'll write that prompt against
`NotificationPreferencesForm.tsx` and the preferences catalog.

There are no other `/notifications/*` routes — the learner inbox is a single screen by design.

---

## Backend gaps this prompt assumes

Almost none, which is unusual for this folder — the screen is designed tightly against what
exists.

| Prompt feature                                                                          | Status                                                                                                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbox list with cursor pagination (limit 1–50, default 25, `nextCursor`, `hasMore`)     | exists                                                                                                                                       |
| Item fields: id, title, body, actionPath, read, readAt, createdAt                       | exists                                                                                                                                       |
| Mark a single notification read, returning `readAt`                                     | exists                                                                                                                                       |
| Derived category, priority, icon, day grouping, timestamp formatting, filter and search | exists, client-side                                                                                                                          |
| The two real channels (in-app, email) on the preferences screen                         | exists                                                                                                                                       |
| Unread dot on the shell's notification entry                                            | needs a cheap unread-exists signal — there is no unread-count endpoint, which is exactly why the design specifies a dot rather than a number |
| Mark all as read                                                                        | does not exist — deliberately not drawn                                                                                                      |
| Unmark as read, archive, delete, star, bulk select                                      | do not exist — deliberately not drawn                                                                                                        |
| Server-authored category, type, or severity                                             | does not exist — the heuristics stand in, and the addendum keeps them quiet for that reason                                                  |

If one thing here is worth changing on the backend, it is the last row: a real `category` or
`eventKey` on the notification record would let the icons, chips, and filters stop guessing. The
current keyword matcher will, for example, tint any notification containing the word "review" as
attention-needed — including a friendly nudge to review a lesson. The design contains that risk;
it does not remove it.
