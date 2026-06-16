# FundedBeyond Academy — Master PRD v1.0

**Tenant #1 on Atlas LMS** · Single-document compilation of all 14 volumes.

---

# Volume 00 — Overview & Index

> **Tenant #1 on Atlas LMS.** This document specifies the *product* — the trader-development experience, content, journeys, diagnostics, community, gamification, and conversion systems of **FundedBeyond Academy** at `academy.fundedbeyond.com`. It does **not** specify platform infrastructure: multi-tenancy, RBAC, database schema, payments rails, video hosting, mobile shell, and analytics plumbing all live in the **Atlas LMS Master PRD** and are assumed to exist. Where the Academy needs a platform capability, this PRD *references the Atlas engine* rather than redesigning it.

---

## How to read this PRD

Start here, then read in order. Each volume is self-contained but cross-references both its siblings and Atlas (notated `Atlas Engine N` or `Atlas Vol X`).

| Vol | File | Contents |
|----|------|----------|
| 00 | `00-README.md` | This index, the Atlas relationship, non-negotiables, Atlas-mapping table, glossary |
| 01 | `01-executive-summary-vision-principles.md` | Executive summary, product vision, product principles, positioning |
| 02 | `02-personas-and-journeys.md` | 7 personas, the Trader Journey Framework, end-to-end user journeys |
| 03 | `03-roadmap-content-strategy.md` | Trader Career Roadmap (7 stages), learning paths, content strategy & cadence |
| 04 | `04-core-modules-part1.md` | Core modules 1–15 (catalog format: purpose/objectives/FR/stories/flows/analytics/AC) |
| 05 | `05-core-modules-part2.md` | Core modules 16–30 |
| 06 | `06-diagnostic-and-readiness-engines.md` | **Free Trading Diagnostic** + **Challenge Readiness Engine** (flagship, full depth) |
| 07 | `07-swipe-learning-engine.md` | **Swipe Learning Engine** (flagship, full depth) |
| 08 | `08-assessment-and-certification.md` | Assessment Center (incl. swipe) + Certification Center (6 certifications) |
| 09 | `09-community-gamification-halloffame.md` | Community design, Hall of Fame, gamification/XP/streaks/leaderboards |
| 10 | `10-analytics-conversion-cta.md` | Analytics, **Challenge Conversion funnel**, CTA strategy & outbound attribution |
| 11 | `11-mobile-and-future-vision.md` | Mobile experience, Trading Journal Integration vision (future) |
| 12 | `12-success-metrics-and-launch.md` | Success metrics, Academy launch roadmap (mapped to Atlas phases) |
| 13 | `13-acceptance-criteria.md` | Acceptance criteria keyed to FundedBeyond modules & engines (§FB-AC-*) |

---

## What FundedBeyond Academy is — and is not

**Is:** an education platform, a trader-development platform, a community platform, and a challenge-readiness/assessment platform. The product objective is not course consumption — it is to **develop better traders** and move them along the trader journey toward becoming funded.

**Is not:** a challenge store. The Academy does **not** sell prop-trading challenges, does not manage trading accounts, does not process challenge billing, and does not touch trading infrastructure. Those belong to the main FundedBeyond ecosystem (`fundedbeyond.com` → Match-Trader).

```
fundedbeyond.com  →  Challenge Purchase  →  Match-Trader  →  Trading Challenge
        ▲
        │  (all challenge CTAs in the Academy redirect here, with attribution)
academy.fundedbeyond.com  (this product: learn → practice → improve → get challenge-ready)
```

---

## FundedBeyond Academy non-negotiables

1. **The Academy never processes a challenge purchase.** Every challenge CTA is an *outbound, attributed redirect* to `fundedbeyond.com` (Vol 10). No challenge checkout, no trading account, no challenge billing inside the Academy.
2. **Develop traders, don't just deliver courses.** Every module is judged by trader improvement and challenge readiness, not content completion (Vol 01 principles).
3. **The journey is the spine.** Visitor → Funded Trader → Ambassador. Every surface moves the user to the next stage (Vol 02).
4. **Two flagship engines are the differentiators:** the Free Trading Diagnostic (top-of-funnel lead gen) and the Challenge Readiness Engine (the gate to a confident, attributed hand-off). Build these to full depth (Vol 06).
5. **Feel like Duolingo for traders, not an LMS.** Swipe learning, streaks, XP, bite-size practice, daily habit (Vol 07, Vol 09).
6. **Ride Atlas; never fork it.** Net-new logic (diagnostic/readiness/swipe/conversion) is implemented as **Atlas Plugins/Extensions (Atlas Engine 34)** and application logic consuming Atlas APIs — not by modifying platform internals.
7. **Conversion is a two-way handshake.** Outbound attribution token on CTA click; inbound challenge-purchase/pass/funded events via **Atlas Integration Engine (27)** so the funnel can be closed and attributed (Vol 10).
8. **Trust is a feature.** Hall of Fame, verifiable certifications, transparent readiness scoring (Vol 08, Vol 09).

---

## Atlas capability mapping (what the Academy rides on)

| Academy need | Atlas engine (assumed to exist) |
|--------------|----------------------------------|
| Branding, theme, custom domain `academy.fundedbeyond.com` | White Label (2), Theme (7), Domain Management (8) |
| Auth, roles, permissions | Role & Permission (3) + Supabase Auth (Atlas Vol 5) |
| Courses, modules, lessons, video (provider-hosted) | LMS (9) |
| Sequenced programs / roadmaps | Learning Path (10) |
| Quizzes, exams, question banks, grading | Assessment (11) |
| Certificates, issuance, verification | Certification (12) |
| XP, badges, streaks, leaderboards primitives | Gamification (13) |
| Forums, groups, posts, moderation | Community (16), Content Moderation (17) |
| Webinars, live sessions, events | Live Learning (18), Webinar (19), Event Management (20) |
| Email/push/in-app notifications | Notification & Communication (26) |
| Inbound/outbound integrations & webhooks | Integration (27) |
| Search across content/community | Search (28) |
| Dashboards & event analytics | Enterprise Analytics (29) + event taxonomy |
| Rule-based and approval workflows | Automation (31), Workflow (32) |
| Net-new Academy logic (diagnostic, readiness, swipe, conversion) | Plugin / Extension (34) + Academy app layer |
| Branded mobile app | Mobile White Label (39) |
| Optional Academy-level paid tiers (if ever introduced) | Commerce (21–25) — *out of scope for v1; challenges are sold externally* |

---

## Glossary

- **Academy** — FundedBeyond Academy, the product specified here.
- **Atlas** — the underlying LMS platform (separate PRD).
- **Challenge** — a funded-trading evaluation sold and run by the main FundedBeyond ecosystem; never inside the Academy.
- **Challenge Ready** — a readiness band (Vol 06) indicating a trader is prepared to attempt a challenge.
- **Diagnostic** — the free trader-readiness evaluation used as the primary lead-gen surface (Vol 06).
- **Readiness Engine** — the system computing a trader's challenge-readiness score and recommendations (Vol 06).
- **Swipe Learning** — Tinder/Duolingo-style rapid binary practice (Vol 07).
- **Conversion** — an attributed challenge purchase on `fundedbeyond.com` originating from the Academy (Vol 10).
- **Funded Trader** — a trader who has passed a challenge and received a funded account (status surfaced in the Academy via inbound integration).


---

# Volume 01 — Executive Summary, Vision & Principles

## 1.1 Executive summary

FundedBeyond Academy is the education, development, community, and challenge-readiness arm of FundedBeyond, running as Tenant #1 on the Atlas LMS platform at `academy.fundedbeyond.com`. Its job is not to sell challenges — challenges are sold and operated by the main ecosystem (`fundedbeyond.com` → Match-Trader). Its job is to take a raw visitor and develop them into a disciplined, risk-aware, psychologically prepared trader who is genuinely **challenge-ready**, then hand them to the challenge purchase flow with high intent and high probability of passing.

The Academy is a top-of-funnel and full-funnel asset simultaneously. At the top, a **Free Trading Diagnostic** converts anonymous visitors into identified leads by scoring their trading readiness across five dimensions and prescribing a path. Through the middle, structured programs, swipe-based daily practice, assessments, and a trading community move users up a defined **trader journey**. Near conversion, the **Challenge Readiness Engine** tells a trader (and FundedBeyond) when they are prepared, and routes them — attributed — to purchase. After funding, the Academy retains traders through the Funded Trader Program, Hall of Fame recognition, and community leadership, turning them into ambassadors and affiliates.

Every capability that is "LMS plumbing" is provided by Atlas and merely configured here. The Academy's defensible product surface is the trader-specific intelligence layer: diagnostic scoring, readiness gating, swipe pedagogy tuned to trading, the trader career roadmap, the community designed around the funded-trader status ladder, and the bidirectional conversion attribution between the Academy and the challenge ecosystem.

## 1.2 Product vision

> **Become the place traders go to get genuinely good — and the reason FundedBeyond's pass rates and funded-trader counts climb.**

A trader should be able to arrive knowing nothing, take a two-minute diagnostic, see exactly where they stand and what to do, build a daily habit of deliberate practice, measure their improvement objectively, and know — not guess — when they are ready to risk a challenge fee. FundedBeyond wins when traders pass; the Academy exists to raise that probability and to make FundedBeyond the obvious place to attempt the challenge once a trader is ready.

Three-year north star: the Academy is the single largest source of *challenge-ready, attributed* challenge purchases for FundedBeyond, and the funded-trader community treats it as their home.

## 1.3 Product principles

1. **Develop traders, don't deliver courses.** The unit of success is measurable trader improvement (readiness score deltas, pass-rate lift), not lessons completed. A user who completes zero courses but raises their readiness band is a win; a user who finishes everything and stalls is a problem to solve.
2. **Diagnose before prescribing.** No generic "start here." Every new user is scored and routed. The product always knows the user's current band and next best action.
3. **Daily habit over binge.** Like Duolingo, the design optimizes for short, frequent, deliberate practice — swipe drills, streaks, micro-assessments — not marathon video sessions.
4. **Readiness is earned and visible.** A trader's challenge readiness is computed from demonstrated competence (assessments, swipe accuracy, discipline signals), shown transparently, and used to gate the challenge CTA's *prominence* — never to block a user, but to time the hand-off for success.
5. **The Academy never sells the challenge.** It builds the trader and points the way. All challenge CTAs are attributed outbound redirects to `fundedbeyond.com`. This boundary is absolute (Vol 10).
6. **Trust compounds.** Funded-trader stories, verifiable certifications, and honest scoring build the credibility that converts skeptical traders. Trust is designed, not assumed.
7. **Community is the moat.** Study groups, challenge groups, funded-trader groups, mentorship, and recognition create retention and word-of-mouth that content alone cannot.
8. **Ride Atlas; extend, don't fork.** Net-new logic plugs into Atlas via its extension points (Atlas Engine 34) and APIs. The Academy never modifies platform internals, so it inherits every Atlas upgrade for free.
9. **Mobile-first habit, desktop-deep study.** Daily practice, swipe, streaks, and community live beautifully on mobile (Atlas Mobile White Label 39); deep program study and analytics are rich on desktop.
10. **Measure the whole funnel, end to end.** From anonymous visitor to funded trader and beyond — including the parts that happen on `fundedbeyond.com` — via the conversion handshake (Vol 10). If it isn't attributable, it isn't done.

## 1.4 Positioning

| Trait | Traditional LMS / course platform | FundedBeyond Academy |
|------|-----------------------------------|----------------------|
| Core unit | Course | Trader readiness |
| Entry point | Course catalog | Free Diagnostic |
| Pedagogy | Long video lessons | Swipe drills + micro-practice + programs |
| Success metric | Completion rate | Readiness lift, pass rate, funded count |
| Monetization | Course/sub sales | None directly — drives attributed challenge purchases externally |
| Emotional model | "Study material" | "Get good. Get funded." (Duolingo-for-traders) |
| Community role | Forum afterthought | Central retention + trust + status ladder |

## 1.5 Strategic role within FundedBeyond

The Academy is a growth and quality flywheel: free diagnostic captures leads → development raises competence → readiness engine times a confident, attributed hand-off → higher pass rates → more funded traders → Hall of Fame and community proof → more visitors take the diagnostic. Its value to the business is measured not in Academy revenue (there is little to none by design) but in **attributed challenge conversions, pass-rate lift, and funded-trader retention** (Vol 12).


---

# Volume 02 — Personas & User Journeys

## 2.1 The Trader Journey Framework

The Academy is architected around one spine. Every screen, notification, and recommendation exists to move a user to the next stage.

```
Visitor → Free User → Learner → Assessment Taker → Challenge Ready Trader
        → Challenge Buyer → Challenge Passer → Funded Trader → Community Leader → Brand Ambassador
```

| Stage | Definition | Primary Academy job | Exit trigger to next stage |
|-------|------------|---------------------|----------------------------|
| Visitor | Anonymous, on site | Capture via Free Diagnostic | Starts diagnostic |
| Free User | Identified, account created | Route to first path; build habit | Completes first learning unit |
| Learner | Actively studying a program | Deliberate practice, streaks | Takes first assessment |
| Assessment Taker | Has taken assessments | Prove & grow competence | Reaches "Developing"+ readiness |
| Challenge Ready Trader | Readiness band ≥ Ready | Confidence + attributed CTA | Clicks challenge CTA → `fundedbeyond.com` |
| Challenge Buyer | Purchased challenge (external) | Support during attempt | Challenge pass event (inbound) |
| Challenge Passer | Passed challenge | Celebrate; onboard to funded program | Funded account confirmed (inbound) |
| Funded Trader | Has funded account | Retain, develop, scale | Joins funded community / mentors |
| Community Leader | Active mentor/contributor | Recognition, responsibility | Opts into ambassador/affiliate |
| Brand Ambassador | Refers & represents | Referral/affiliate education | — (flywheel) |

Stage is a first-class property of every user, derived from Academy signals plus inbound challenge events (Vol 10). The current stage drives homepage layout, recommendations, CTA prominence, and notifications.

## 2.2 Personas

Each persona below defines: goals, pain points, learning objectives, motivations, journey position, and success metrics.

### 2.2.1 Beginner Trader — "Sam, the curious newcomer"
- **Goals:** understand how trading and funded challenges work; not lose money being naive; find a trustworthy starting point.
- **Pain points:** overwhelmed by jargon and YouTube noise; doesn't know what they don't know; afraid of scams.
- **Learning objectives:** market basics, terminology, what a funded challenge is, basic risk, why discipline matters.
- **Motivations:** curiosity, financial hope, fear of wasting money.
- **Journey position:** Visitor → Free User → Learner.
- **Success metrics:** completes diagnostic; starts Foundations program; 3-day streak; readiness moves Beginner → Developing.

### 2.2.2 Intermediate Trader — "Maya, the self-taught grinder"
- **Goals:** plug knowledge gaps; stop blowing accounts; develop a repeatable edge.
- **Pain points:** inconsistent results; over-trades; knows some TA but weak on risk/psychology; has failed a challenge before.
- **Learning objectives:** market structure, strategy formalization, position sizing, journaling, emotional control.
- **Motivations:** frustration with plateaus; proof she can do this; wants to pass a challenge.
- **Journey position:** Learner → Assessment Taker → Challenge Ready.
- **Success metrics:** readiness Developing → Ready; assessment scores rising; swipe accuracy ≥ target; takes Challenge Prep.

### 2.2.3 Advanced Trader — "Devang, the skilled but undisciplined"
- **Goals:** convert skill into funded capital; tighten risk and consistency; validate readiness objectively.
- **Pain points:** good analysis, poor discipline; tilt and revenge trading; underestimates challenge rules (drawdown, daily loss).
- **Learning objectives:** challenge rule mastery, drawdown management, psychology under pressure, pre-challenge simulation.
- **Motivations:** ego + opportunity; wants the capital, not the lessons.
- **Journey position:** Assessment Taker → Challenge Ready → Challenge Buyer.
- **Success metrics:** Challenge Readiness Engine flags Ready/Challenge Ready; completes Challenge Readiness Center checklist; converts.

### 2.2.4 Challenge Trader — "Priya, mid-attempt"
- **Goals:** pass the challenge she has purchased; manage rules and pressure day to day.
- **Pain points:** anxiety; rule confusion; tempted to deviate from plan; isolation during the attempt.
- **Learning objectives:** rule adherence, daily routine, loss-limit psychology, when to stop.
- **Motivations:** sunk challenge fee; the funded payout; fear of failing.
- **Journey position:** Challenge Buyer (active attempt).
- **Success metrics:** active in Challenge Group; daily check-ins/streak; reduced rule-violation behaviors; pass event.

### 2.2.5 Funded Trader — "Arjun, the funded operator"
- **Goals:** keep the account; scale; stay disciplined long-term; help others.
- **Pain points:** complacency; scaling risk; loneliness at the top; payout/consistency rules.
- **Learning objectives:** account scaling, advanced risk, long-term consistency, mentoring skills.
- **Motivations:** income, status, mastery, giving back.
- **Journey position:** Funded Trader → Community Leader.
- **Success metrics:** active in Funded Trader Group; Hall of Fame feature; mentors others; retention beyond 90 days.

### 2.2.6 Community Member — "Lena, the social learner"
- **Goals:** belong, learn socially, stay motivated, get questions answered fast.
- **Pain points:** learning alone is demotivating; needs accountability; wants peers at her level.
- **Learning objectives:** whatever her band needs, reinforced socially.
- **Motivations:** belonging, accountability, recognition.
- **Journey position:** spans all stages; the social connective tissue.
- **Success metrics:** group membership; posts/replies; streak maintained via accountability; referral activity.

### 2.2.7 Affiliate Partner — "Carlos, the promoter"
- **Goals:** earn by referring traders; represent a credible brand; get assets and education to promote well.
- **Pain points:** doesn't understand the product deeply; lacks compliant messaging; unclear attribution.
- **Learning objectives:** product knowledge, compliant promotion, how the funnel works, affiliate best practices.
- **Motivations:** income, status, audience growth.
- **Journey position:** Brand Ambassador.
- **Success metrics:** completes Affiliate Education; generates attributed visitors/diagnostics; referred users convert.

## 2.3 End-to-end user journeys

### Journey A — Cold visitor to challenge-ready (the core funnel)
1. Visitor lands on Academy homepage or a diagnostic ad. Primary CTA: **Take the Free Trading Diagnostic** (Vol 06).
2. Completes 2–3 minute diagnostic → identified as Free User → sees a five-dimension scorecard and a readiness band.
3. Receives a prescribed Learning Path (Vol 03) tuned to weakest dimensions; nudged into a daily swipe habit (Vol 07).
4. Builds streaks, completes program modules, takes assessments (Vol 08); readiness band rises as competence is demonstrated.
5. Reaches **Ready / Challenge Ready** → Challenge Readiness Center confirms with a checklist and simulation review (Vol 06).
6. Clicks **Start Your Challenge** → attributed outbound redirect to `fundedbeyond.com` (Vol 10). Academy's direct job ends; support continues.

### Journey B — Challenge attempt support
1. Inbound event: challenge purchased (Vol 10) → user stage = Challenge Buyer → auto-enrolled in Challenge Group + Challenge Prep daily routine.
2. Daily check-ins, rule-adherence micro-lessons, psychology drills during the attempt.
3. Inbound event: challenge passed → celebration, Hall of Fame nomination, Funded Trader Program unlock.

### Journey C — Funded trader retention & advocacy
1. Funded status confirmed (inbound) → Funded Trader Program + Funded Trader Group + Funded Trader Certification.
2. Recognition via Hall of Fame; invited to mentor and run AMAs.
3. Opts into Referral/Affiliate Education → becomes Brand Ambassador, feeding new visitors into Journey A.

### Journey D — Returning lapsed user
1. Streak break / inactivity detected (Atlas Automation 31) → re-engagement notification (Atlas Notification 26): "Your readiness is slipping — 3 swipes to recover your streak."
2. Quick swipe session restores habit; re-diagnostic offered if long lapse to re-baseline.

## 2.4 Analytics for journeys (summary)
Stage transitions are tracked as first-class events (Vol 10). Key journey analytics: stage-to-stage conversion rates, time-in-stage, drop-off points, diagnostic→Ready conversion, Ready→challenge-click, click→purchase (attributed), purchase→pass, pass→funded, funded→mentor. These feed the Challenge Conversion funnel (Vol 10) and success metrics (Vol 12).

## 2.5 Acceptance (headline)
Every user has a derived journey stage; the homepage, recommendations, and CTA prominence change by stage; stage transitions emit analytics events; and the full Visitor→Funded→Ambassador funnel is measurable including externally-completed steps via the conversion handshake. (Vol 13 §FB-AC-Journey.)


---

# Volume 03 — Trader Career Roadmap & Content Strategy

> This volume defines *what is taught and in what order*. It is implemented as configuration of the Atlas Learning Path Engine (10), Atlas LMS Engine (9), and Atlas content structures — not new platform code. The intellectual property here is the trader-development curriculum and its sequencing, not the delivery mechanism.

## 3.1 Trader Career Roadmap — "Road to Funded Trader"

A single, visible, gamified spine. A trader always knows which stage they are in and what unlocks next. Stage advancement is gated by demonstrated competence (assessments + swipe accuracy + readiness signals), not mere completion.

| Stage | Name | Trader can… | Gate to advance | Maps to readiness band (Vol 06) |
|------|------|-------------|-----------------|----------------------------------|
| 1 | Foundations | Speak the language; understand markets, instruments, and what a funded challenge is | Foundations assessment ≥ pass; swipe accuracy ≥ 70% | Beginner → Developing |
| 2 | Market Structure | Read structure, trend, key levels, timeframes | Market-structure assessment + chart-swipe accuracy ≥ 75% | Developing |
| 3 | Strategy Development | Define a repeatable, rule-based edge with a written plan | Submit a trading plan (reviewed via Atlas Workflow 32); strategy assessment pass | Developing → Ready |
| 4 | Risk Management | Size positions; manage drawdown & daily loss limits; survive | Risk assessment pass; risk-scenario swipe ≥ 80% | Ready |
| 5 | Psychology | Manage tilt, fear, greed, discipline under pressure | Psychology assessment pass; scenario-swipe ≥ 80% | Ready |
| 6 | Challenge Readiness | Master the specific challenge ruleset; pass a simulated readiness review | Challenge Readiness Engine = Challenge Ready (Vol 06) | Challenge Ready |
| 7 | Funded Trader | Scale, stay consistent, mentor | Funded status confirmed (inbound, Vol 10) | Elite |

The roadmap is rendered as a visual path (Vol 04 module: Learning Paths) with locked/unlocked stages, progress, and the next gate clearly shown.

## 3.2 Programs (curricula)

Each program is an Atlas Learning Path (10) composed of Atlas courses/modules/lessons (9), plus swipe decks (Vol 07), assessments (Vol 08), and a certification (Vol 08).

1. **Beginner Trader Program** → Stage 1. Outcomes: literacy, safety, motivation. Heavy swipe + short video.
2. **Intermediate Trader Program** → Stages 2–3. Outcomes: structure reading, strategy formalization, journaling habit.
3. **Advanced Trader Program** → Stages 3–4. Outcomes: edge refinement, advanced risk, consistency.
4. **Trading Psychology Program** → Stage 5 (cross-cutting). Outcomes: tilt control, routine, pressure management.
5. **Risk Management Program** → Stage 4 (cross-cutting). Outcomes: sizing, drawdown/daily-loss mastery, survival math.
6. **Challenge Preparation Program** → Stage 6. Outcomes: challenge-rule mastery, pre-attempt simulation, daily routine.
7. **Funded Trader Program** → Stage 7. Outcomes: scaling, long-term consistency, mentoring.

Psychology and Risk are deliberately cross-cutting: surfaced early as primers and revisited deeply later, because they are the dimensions that most determine challenge pass rates.

## 3.3 Course categories (catalog taxonomy)

- Trading Foundations
- Markets & Instruments (FX, indices, metals, crypto as offered)
- Technical Analysis & Market Structure
- Strategy & Systems
- Risk Management
- Trading Psychology
- Challenge Rules & Preparation (FundedBeyond/Match-Trader specifics)
- Funded Account Management & Scaling
- Tools & Journaling
- Community & Mentorship resources

## 3.4 Learning paths vs certification paths
- **Learning paths** (Vol 03 programs) = the developmental sequence.
- **Certification paths** (Vol 08) = the credential ladder earned along the way: Trading Foundations → Risk Management → Psychology → Challenge Preparation → Challenge Readiness → Funded Trader. Certifications are evidence of competence and trust artifacts (verifiable via Atlas Certification 12).

## 3.5 Content strategy & cadence

The Academy is a living product; static content decays. Cadence keeps the habit alive and the community warm.

### Weekly
- 3–5 new **swipe decks** (fresh setups/charts/psychology scenarios) — the daily-habit fuel (Vol 07).
- 1 **live webinar** (Atlas Webinar 19): market breakdowns, challenge Q&A, strategy clinics.
- 1 **community challenge** (e.g., "spot the invalid setup" week) with leaderboard (Vol 09).
- Weekly market-structure recap content.

### Monthly
- 1 new or refreshed **mini-program/module** addressing a common failure pattern surfaced by analytics (e.g., "Daily Loss Limit Discipline").
- 1 **Funded Trader interview / case study** for Hall of Fame (Vol 09) — trust + motivation.
- 1 **AMA** with a funded trader or coach.
- Monthly leaderboard reset + recognition.

### Quarterly
- Curriculum review driven by **conversion + pass-rate analytics** (Vol 10/12): which content correlates with readiness lift and passing? Double down; prune the rest.
- 1 flagship program update (new strategy module, refreshed challenge-rule content if Match-Trader/FundedBeyond rules change).
- Seasonal **community event** (cohort challenge, themed competition).

### Live webinar strategy
- Recurring weekly slot for habit; topical one-offs around market events; "Challenge Ready Clinic" monthly aimed squarely at Stage 6 users; recordings added to Resource Library (Vol 05 module 22).

### Community strategy
- Seed every band with an active group; ensure no question goes unanswered > X hours (moderation + mentor incentives, Vol 09); spotlight member wins weekly; run cohort challenges to manufacture momentum and streak adherence.

## 3.6 Content-to-journey mapping principle
Content is never published into a vacuum. Each asset is tagged with: target stage, target readiness dimension(s) it improves, and the persona it serves. The recommendation system (Vol 06) uses these tags to prescribe the *next best content* for each user's weakest dimension — the core of "diagnose before prescribing" (Vol 01).

## 3.7 Analytics requirements (content)
Track per asset: starts, completions, swipe accuracy lift, correlation with readiness-band advancement, correlation with downstream challenge conversion and pass. Surface "content effectiveness" (not just consumption) so quarterly review can prune low-impact content. (Feeds Vol 10/12.)

## 3.8 Acceptance (headline)
The roadmap renders as a 7-stage gated visual path; advancement requires demonstrated competence, not completion; programs/certifications map cleanly onto Atlas Learning Path/Certification engines; content carries stage/dimension/persona tags that drive recommendations; and content effectiveness (readiness lift, conversion correlation) is measured, not just consumption. (Vol 13 §FB-AC-Roadmap, §FB-AC-Content.)


---

# Volume 04 — Core Modules (1–15)

> Module catalog. Each entry gives Purpose, Objectives, Functional Requirements (FR), User Stories (US), User Flows (UF), Analytics, and Acceptance. Platform mechanics are inherited from Atlas (engine noted); only FundedBeyond product behavior is specified. Flagship systems are summarized here and fully specified in their own volumes (06–10).

---

## Module 1 — Academy Homepage
- **Purpose.** Convert visitors and orient returning users by journey stage.
- **Objectives.** Drive diagnostic starts (visitors); surface next-best-action (logged-in); build trust.
- **FR.** Stage-aware layout (Vol 02): visitors see a diagnostic-first hero + trust proof (Hall of Fame snippet, funded counts); logged-in users see their readiness band, streak, next lesson/swipe, and current-stage CTA. Renders via Atlas White Label/Theme (2/7).
- **US.** As a visitor I see one obvious next step (the diagnostic). As a returning learner I land directly on my next action.
- **UF.** Visitor → hero CTA → diagnostic. Learner → "Continue" → last program/swipe. Challenge Ready → prominent attributed challenge CTA (Vol 10).
- **Analytics.** Hero CTA CTR, diagnostic-start rate, stage-segmented engagement, bounce.
- **Acceptance.** Layout and primary CTA differ by stage; visitors are funneled to the diagnostic; challenge CTAs only ever redirect outbound (Vol 10). §FB-AC-Home.

## Module 2 — Course Catalog
- **Purpose.** Let users browse/discover structured content by category and stage.
- **Objectives.** Findability; route to the right program; reinforce the roadmap.
- **FR.** Categories per Vol 03.3; filter by stage/dimension/persona/certification; show locked/unlocked state vs roadmap; search via Atlas Search (28). Content from Atlas LMS (9).
- **US.** As an intermediate trader I filter to risk-management content at my level.
- **UF.** Catalog → filter → course detail → enroll (Atlas LMS) → program.
- **Analytics.** Search queries, filter usage, catalog→enroll conversion, zero-result searches.
- **Acceptance.** Catalog reflects roadmap lock state and dimension tags; search returns only Academy content. §FB-AC-Catalog.

## Module 3 — Learning Paths
- **Purpose.** Render the Trader Career Roadmap and program sequences as guided journeys.
- **Objectives.** Make the path and next gate unmistakable; gate by competence.
- **FR.** Visual 7-stage roadmap (Vol 03.1) with progress, locks, and the next competence gate; per-program path views; built on Atlas Learning Path (10). Advancement gated by assessment/swipe/readiness signals (Vol 06/08).
- **US.** As a learner I always see what stage I'm in and exactly what unlocks the next.
- **UF.** Roadmap → stage detail → required units → gate (assessment) → unlock next.
- **Analytics.** Stage advancement rate, time-in-stage, gate pass/fail, drop-off per stage.
- **Acceptance.** Stages gate on demonstrated competence, not completion; next gate always visible. §FB-AC-Paths.

## Module 4 — Beginner Trader Program
- **Purpose.** Take a novice to literate and safe (Stage 1).
- **Objectives.** Terminology, market basics, what a challenge is, basic risk, motivation + habit.
- **FR.** Atlas Learning Path (10) of short lessons (9) + heavy swipe (Vol 07) + Foundations assessment (Vol 08) + Trading Foundations certification (Vol 08). Tuned for mobile habit (Vol 11).
- **US.** As a beginner I learn the language without being overwhelmed.
- **UF.** Enroll → daily swipe + micro-lessons → Foundations assessment → certificate → Stage 2 unlock.
- **Analytics.** Completion, swipe accuracy lift, Beginner→Developing band movement, day-3/day-7 retention.
- **Acceptance.** Completing the program + passing its gate advances readiness band and unlocks Stage 2. §FB-AC-ProgBeg.

## Module 5 — Intermediate Trader Program
- **Purpose.** Build structure reading and a formal edge (Stages 2–3).
- **Objectives.** Market structure mastery; a written, rule-based plan; journaling habit.
- **FR.** Path (10) + chart-swipe decks + plan submission reviewed via Atlas Workflow (32) + assessments + progression. 
- **US.** As a self-taught trader I formalize my scattered knowledge into a plan.
- **UF.** Structure modules → chart swipe → submit trading plan → review/feedback → strategy assessment → advance.
- **Analytics.** Plan submission/approval rate, chart-swipe accuracy, Developing→Ready movement.
- **Acceptance.** Plan submission + strategy assessment gate Stage 3→4. §FB-AC-ProgInt.

## Module 6 — Advanced Trader Program
- **Purpose.** Refine edge, harden risk, drive consistency (Stages 3–4).
- **Objectives.** Edge refinement, advanced sizing/drawdown, pre-challenge consistency.
- **FR.** Path (10) + advanced risk scenarios (swipe + assessment) + consistency tracking; links to Challenge Prep.
- **US.** As a skilled-but-inconsistent trader I tighten risk and prove consistency.
- **UF.** Advanced modules → risk-scenario swipe → risk assessment → consistency checklist → Stage 6 entry.
- **Analytics.** Risk-scenario accuracy, consistency metrics, Ready-band attainment.
- **Acceptance.** Risk assessment pass + consistency checklist gate entry to Challenge Readiness. §FB-AC-ProgAdv.

## Module 7 — Trading Psychology Program
- **Purpose.** Develop discipline and emotional control under pressure (Stage 5, cross-cutting).
- **Objectives.** Manage tilt/fear/greed; build routine; perform under challenge pressure.
- **FR.** Path (10) + psychology scenario swipe decks (Vol 07) + scenario assessments; primer surfaced early, depth later (Vol 03.2). Discipline signals feed readiness (Vol 06).
- **US.** As a trader who tilts I learn concrete routines to stay disciplined.
- **UF.** Primer (early) → scenario swipe (ongoing) → deep program → psychology assessment → certification.
- **Analytics.** Scenario accuracy, discipline-signal trend, correlation with pass rate.
- **Acceptance.** Psychology assessment pass + scenario-swipe threshold contribute to readiness psychology score. §FB-AC-ProgPsy.

## Module 8 — Risk Management Program
- **Purpose.** Make survival and drawdown discipline automatic (Stage 4, cross-cutting).
- **Objectives.** Position sizing, daily-loss/drawdown limits, survival math, challenge-rule risk.
- **FR.** Path (10) + risk calculators/tools (Resource Library, Module 22) + risk-scenario swipe + assessment. Challenge-rule-specific risk content tagged to Stage 6.
- **US.** As a trader who blows accounts I learn to size and cap losses correctly.
- **UF.** Sizing lessons → calculator practice → risk swipe → risk assessment → readiness risk score.
- **Analytics.** Risk assessment scores, sizing-tool usage, correlation with pass/fail.
- **Acceptance.** Risk assessment + scenario-swipe threshold set the readiness risk-management score. §FB-AC-ProgRisk.

## Module 9 — Challenge Preparation Program
- **Purpose.** Make the trader fluent in the *specific* challenge ruleset and routine (Stage 6).
- **Objectives.** Master FundedBeyond/Match-Trader challenge rules (drawdown, daily loss, targets, time); build a daily attempt routine; simulate.
- **FR.** Path (10) of challenge-rule lessons + rule-scenario swipe + a simulated readiness review + daily-routine builder. Feeds Challenge Readiness Engine (Vol 06). **No purchase here** — only preparation.
- **US.** As an advanced trader I learn the exact rules I'll be judged on and rehearse them.
- **UF.** Rule modules → rule-scenario swipe → simulated review → routine plan → Challenge Readiness check (Vol 06).
- **Analytics.** Rule-comprehension scores, simulated-review results, completion→challenge-click rate.
- **Acceptance.** Completion contributes to "Challenge Ready" band; never exposes a purchase flow. §FB-AC-ProgPrep.

## Module 10 — Funded Trader Program
- **Purpose.** Retain and grow funded traders (Stage 7).
- **Objectives.** Account scaling, long-term consistency, payout/consistency-rule mastery, mentoring skills.
- **FR.** Path (10) unlocked by inbound funded status (Vol 10); scaling/consistency content; mentor-training module; access to Funded Trader Group (Vol 09) + Funded Trader Certification.
- **US.** As a funded trader I learn to keep and scale my account and to mentor.
- **UF.** Funded status confirmed → program unlock → scaling modules → Funded Trader Certification → mentor opt-in.
- **Analytics.** Funded retention (30/60/90d), scaling milestones, mentor conversion.
- **Acceptance.** Unlocks only on confirmed funded status; drives funded retention metrics (Vol 12). §FB-AC-ProgFunded.

## Module 11 — Assessment Center
- **Purpose.** Measure and grow competence across all dimensions and gate progression.
- **Objectives.** Reliable, varied assessment that feeds readiness and unlocks stages.
- **FR.** Full spec in Vol 08. Built on Atlas Assessment (11) with FundedBeyond question banks + the swipe-assessment type (Vol 07). Supports MCQ, multi-select, true/false, scenario, image, chart-analysis, swipe.
- **US.** As a learner my assessments reflect real trading judgment, not trivia.
- **UF.** Enter assessment → mixed item types → score → readiness update → stage gate result.
- **Analytics.** Item difficulty/discrimination, score distributions, readiness contribution, retake patterns.
- **Acceptance.** Assessment results write to readiness dimensions and gate stages. §FB-AC-Assess (see Vol 08).

## Module 12 — Certification Center
- **Purpose.** Issue verifiable credentials that mark competence and build trust.
- **Objectives.** Six certifications mapped to the roadmap; verifiable; motivating.
- **FR.** Full spec in Vol 08. Built on Atlas Certification (12). Issuance gated by assessments/program completion; public verification link.
- **US.** As a trader I earn certificates that prove I'm ready and that I can share.
- **UF.** Meet criteria → certificate issued → shareable/verifiable → next cert unlocked.
- **Analytics.** Issuance counts, time-to-cert, share rate, correlation with conversion.
- **Acceptance.** Certs issue only on met criteria; each is independently verifiable. §FB-AC-Cert (see Vol 08).

## Module 13 — Swipe Learning Center
- **Purpose.** Daily, habit-forming, binary practice — the Academy's signature pedagogy.
- **Objectives.** Build a daily streak; sharpen setup/chart/psychology judgment fast; feed readiness.
- **FR.** Full spec in Vol 07. Implemented via Atlas Plugin/Extension (34) + Assessment (11) item type; decks tagged by dimension/stage.
- **US.** As any trader I can do a 2-minute swipe session daily and feel sharper.
- **UF.** Open swipe → deck (by weakest dimension) → swipe right/left → instant feedback → streak/XP → readiness update.
- **Analytics.** Daily active swipers, accuracy by dimension, streak distribution, readiness lift.
- **Acceptance.** Swipe accuracy by dimension feeds readiness; streaks drive retention. §FB-AC-Swipe (see Vol 07).

## Module 14 — Community Hub
- **Purpose.** The social home; entry to all community surfaces.
- **Objectives.** Belonging, accountability, fast answers, motivation.
- **FR.** Full spec in Vol 09. Built on Atlas Community (16) + Moderation (17). Hub routes to public/private/study/challenge/funded groups, mentorship, AMAs, leaderboards.
- **US.** As a social learner I find my people at my level.
- **UF.** Hub → recommended groups (by stage/band) → join → participate.
- **Analytics.** Group joins, posts/replies, answer time, retention correlation.
- **Acceptance.** Hub recommends groups by stage/band; routes to all community surfaces. §FB-AC-Community (see Vol 09).

## Module 15 — Public Community
- **Purpose.** Open, trust-building, top-of-funnel social space.
- **Objectives.** Show vibrancy and credibility to visitors/free users; capture into deeper engagement.
- **FR.** Atlas Community (16) public space; visible (read) to visitors per config; posting requires account; moderated (17). Hosts wins, market talk, beginner Q&A.
- **US.** As a visitor I see an active, credible community before I commit.
- **UF.** Visitor reads public community → prompted to join → free user → routed to relevant private group.
- **Analytics.** Public→signup conversion, read-to-post conversion, content sentiment.
- **Acceptance.** Public space is readable pre-signup (per config) and converts to accounts; posting gated to members. §FB-AC-PubCommunity.


---

# Volume 05 — Core Modules (16–30)

> Continuation of the module catalog (same template). Platform mechanics inherited from Atlas; only FundedBeyond product behavior specified.

---

## Module 16 — Private Community
- **Purpose.** Members-only space for committed learners by band/stage.
- **Objectives.** Deeper accountability, higher-signal discussion, retention.
- **FR.** Atlas Community (16) private spaces gated by membership/stage; band-segmented sub-spaces; moderated (17).
- **US.** As a committed learner I get a focused space without beginner noise.
- **UF.** Free/learner joins → matched to band space → participates → graduates to next band space as readiness rises.
- **Analytics.** Private engagement rate, band-space activity, retention vs public-only users.
- **Acceptance.** Access gated by stage/band; membership moves with readiness. §FB-AC-PrivCommunity.

## Module 17 — Study Groups
- **Purpose.** Small accountable cohorts learning a program together.
- **Objectives.** Accountability, streak adherence, peer help.
- **FR.** Atlas Community (16) group type; cohort formed around a program/stage; shared goals, group streaks, scheduled check-ins (Atlas Automation 31 + Notification 26).
- **US.** As a learner I stay consistent because my group expects me.
- **UF.** Join program → auto-suggested study group → shared goals → group check-ins → collective progress.
- **Analytics.** Group streak adherence, completion lift vs solo, churn reduction.
- **Acceptance.** Study-group members show measurably higher streak/completion than solo baseline. §FB-AC-StudyGroups.

## Module 18 — Challenge Groups
- **Purpose.** Support traders during an active challenge attempt.
- **Objectives.** Rule adherence, daily routine, emotional support, reduce mid-attempt mistakes.
- **FR.** Atlas Community (16) group, auto-joined on inbound challenge-purchase event (Vol 10); daily check-in prompts; rule-reminder micro-content; psychology support. **No trading data ingested** (out of scope) — self-reported check-ins only in v1.
- **US.** As a challenge trader I'm not alone during the most stressful weeks.
- **UF.** Challenge purchased (inbound) → auto-join → daily check-in + routine → pass/fail event → next group.
- **Analytics.** Check-in adherence, self-reported rule violations trend, group-membership vs pass rate.
- **Acceptance.** Membership auto-granted on inbound purchase; correlates with pass-rate analysis (Vol 12). §FB-AC-ChallengeGroups.

## Module 19 — Funded Trader Groups
- **Purpose.** Elite community for funded traders.
- **Objectives.** Retention, scaling support, mentorship supply, status.
- **FR.** Atlas Community (16) group gated by inbound funded status (Vol 10); private; mentor identification; advanced discussion; Hall of Fame pipeline.
- **US.** As a funded trader I belong to a room of peers who get it.
- **UF.** Funded confirmed → auto-join → peer support/scaling → opt into mentoring.
- **Analytics.** Funded retention, mentor conversion, scaling-milestone sharing.
- **Acceptance.** Access strictly gated by confirmed funded status. §FB-AC-FundedGroups.

## Module 20 — Webinar Center
- **Purpose.** Live teaching, market breakdowns, challenge clinics.
- **Objectives.** Habit, depth, trust, conversion (Challenge Ready Clinic).
- **FR.** Atlas Webinar (19) + Live Learning (18); weekly recurring slot (Vol 03.5); registration, reminders (26), recordings to Resource Library (Module 22); stage-targeted sessions.
- **US.** As a trader I join a weekly live session and can ask questions.
- **UF.** Browse webinars → register → reminder → attend → recording archived.
- **Analytics.** Registration/attendance, attendance→readiness lift, clinic→challenge-click rate.
- **Acceptance.** Recurring + topical webinars run via Atlas; recordings archived; clinics target Stage 6. §FB-AC-Webinar.

## Module 21 — Event Center
- **Purpose.** Structured events: cohorts, competitions, seasonal community events.
- **Objectives.** Momentum, engagement spikes, community bonding.
- **FR.** Atlas Event Management (20); event types: cohort launches, trading competitions (educational/demo only — no real challenge accounts), AMA series, seasonal events; registration + leaderboards (Vol 09).
- **US.** As a member I join a 4-week cohort competition that keeps me engaged.
- **UF.** Discover event → register → participate → leaderboard → recognition.
- **Analytics.** Event participation, engagement lift during events, retention post-event.
- **Acceptance.** Events run via Atlas Event Management; no event touches real challenge infrastructure. §FB-AC-Events.

## Module 22 — Resource Library
- **Purpose.** Searchable repository of tools, templates, recordings, cheat-sheets.
- **Objectives.** On-demand support; reduce friction; reinforce learning.
- **FR.** Atlas LMS (9) + Search (28); hosts risk calculators, plan templates, journaling templates, webinar recordings, challenge-rule cheat-sheets; tagged by dimension/stage.
- **US.** As a trader I quickly grab a position-size calculator or plan template.
- **UF.** Library → search/filter → open/download resource.
- **Analytics.** Resource usage, search success, correlation with readiness lift.
- **Acceptance.** Resources tagged and searchable; usage tracked. §FB-AC-Library.

## Module 23 — Trader Dashboard
- **Purpose.** The trader's home base — current state and next action at a glance.
- **Objectives.** Orient by stage; surface readiness, streak, next gate, recommendations.
- **FR.** Composite view: readiness band + five-dimension scorecard (Vol 06), streak/XP/level (Vol 09), current program & next gate (Vol 03), recommended next content/swipe, stage-appropriate CTA. Built from Atlas Analytics (29) + Academy app layer.
- **US.** As any trader I open my dashboard and instantly know what to do next.
- **UF.** Login → dashboard → next-best-action → act.
- **Analytics.** Dashboard→action CTR, recommendation acceptance, time-to-next-action.
- **Acceptance.** Dashboard is stage-aware and always presents a clear next best action. §FB-AC-Dashboard.

## Module 24 — Progress Dashboard
- **Purpose.** Deep view of improvement over time.
- **Objectives.** Make growth visible and motivating; show readiness trajectory.
- **FR.** Trends for each readiness dimension, assessment history, swipe accuracy over time, streak history, stage timeline, certifications earned. Atlas Analytics (29) + Academy metrics.
- **US.** As a trader I see proof I'm improving across weeks.
- **UF.** Dashboard → progress → dimension trends → drill into history.
- **Analytics.** Progress-view engagement, correlation with retention.
- **Acceptance.** Shows per-dimension readiness trajectory over time. §FB-AC-Progress.

## Module 25 — Achievement System
- **Purpose.** Reward behavior and milestones to drive habit and progression.
- **Objectives.** Reinforce daily practice, stage advancement, community contribution.
- **FR.** Full spec in Vol 09. Atlas Gamification (13): XP, levels, streaks, badges, milestones; trader-specific achievements (e.g., "30-day streak", "Risk Master", "First Plan Approved", "Challenge Ready").
- **US.** As a trader I earn badges that mark real progress.
- **UF.** Perform action → award → notification → profile/Hall of Fame.
- **Analytics.** Achievement earn rates, correlation with retention/conversion.
- **Acceptance.** Achievements map to meaningful trader behaviors, not vanity. §FB-AC-Achievements (see Vol 09).

## Module 26 — Hall of Fame
- **Purpose.** Showcase funded traders and top performers — trust + motivation.
- **Objectives.** Social proof for conversion; aspiration; community recognition.
- **FR.** Full spec in Vol 09. Recently funded traders, success stories, interviews, case studies, monthly top performers; populated from inbound funded events (Vol 10) + editorial; consent-gated.
- **US.** As a visitor I see real people who got funded here.
- **UF.** Public Hall of Fame → story → diagnostic/CTA. Funded trader consents → featured.
- **Analytics.** Hall-of-Fame views, view→diagnostic/CTA conversion, feature opt-in rate.
- **Acceptance.** Features are consent-gated and (for funded claims) backed by inbound funded events. §FB-AC-HallOfFame (see Vol 09).

## Module 27 — Referral Education Center
- **Purpose.** Teach existing users to refer effectively.
- **Objectives.** Turn satisfied traders into a growth channel; ensure compliant messaging.
- **FR.** Education content on how/why to refer; personal referral links with attribution (Vol 10); explains the funnel; integrates with main-ecosystem referral program via Atlas Integration (27). Academy does not pay challenge commissions (handled externally).
- **US.** As a happy trader I learn how to refer friends and track it.
- **UF.** Referral center → learn → get attributed link → share → see referred activity.
- **Analytics.** Referral-link generation, referred visitors/diagnostics, referred conversions (attributed).
- **Acceptance.** Referral links carry attribution; referred conversions are traceable via the handshake (Vol 10). §FB-AC-Referral.

## Module 28 — Affiliate Education Center
- **Purpose.** Train affiliate partners to promote credibly and compliantly.
- **Objectives.** Equip affiliates with product knowledge, assets, compliant messaging.
- **FR.** Affiliate curriculum (Atlas LMS 9) + Affiliate Certification; asset library; compliance guidelines; ties to main affiliate program via Atlas Integration (27). Affiliate payouts handled by main ecosystem, not the Academy.
- **US.** As an affiliate I learn the product deeply and get compliant assets.
- **UF.** Affiliate enrolls → curriculum → certification → assets → promotes with attributed links.
- **Analytics.** Affiliate completion/certification, asset usage, affiliate-attributed conversions.
- **Acceptance.** Affiliate education gates access to assets; promotion uses attributed links; payouts are external. §FB-AC-Affiliate.

## Module 29 — Mobile Experience
- **Purpose.** Deliver the daily-habit Academy on mobile.
- **Objectives.** Swipe, learn, assess, community, notifications, progress — on the go.
- **FR.** Full spec in Vol 11. Runs on Atlas Mobile White Label (39) branded app; prioritizes swipe + streaks + community + notifications; offline swipe where feasible (Atlas mobile offline).
- **US.** As a trader I do my daily swipe on my phone during a commute.
- **UF.** Open app → daily swipe prompt → quick session → streak kept → community glance.
- **Analytics.** Mobile DAU, mobile swipe sessions, push opt-in, mobile retention.
- **Acceptance.** Daily habit loop (swipe/streak/notify) is first-class on mobile. §FB-AC-Mobile (see Vol 11).

## Module 30 — Challenge Readiness Center
- **Purpose.** The decision surface that tells a trader they're ready and routes them to the challenge — attributed.
- **Objectives.** Confidence, honest gating, high-intent attributed hand-off; never a purchase.
- **FR.** Full spec in Vol 06. Shows Challenge Readiness score/band, the readiness checklist, simulated-review results, gaps to close, and — when Challenge Ready — a prominent **Start Your Challenge** CTA that is an attributed outbound redirect to `fundedbeyond.com` (Vol 10). Never processes a purchase.
- **US.** As a prepared trader I get a clear "you're ready" with proof, then a one-tap path to start.
- **UF.** Center → readiness summary → close gaps (if any) → Challenge Ready → attributed CTA → `fundedbeyond.com`.
- **Analytics.** Readiness-band distribution, checklist completion, Center→challenge-click, click→purchase (attributed).
- **Acceptance.** CTA appears only as an outbound attributed redirect; the Center never exposes checkout. §FB-AC-ReadinessCenter (see Vol 06, Vol 10).


---

# Volume 06 — Free Trading Diagnostic & Challenge Readiness Engine

> The two flagship, FundedBeyond-specific systems. Both are **application-layer engines** built on Atlas extension points (Plugin/Extension Engine 34) and consuming Atlas Assessment (11), Learning Path (10), and Analytics (29) APIs. They are not platform features — they are the Academy's defensible product intelligence. They share a common scoring substrate: the **Five Dimensions of Trader Readiness**.

## 6.0 The Five Dimensions (shared scoring substrate)

Every readiness computation in the Academy resolves to five 0–100 dimension scores:

1. **Technical Analysis (TA)** — reading structure, levels, setups, entries/exits.
2. **Trading Psychology (PSY)** — discipline, tilt control, patience, emotional regulation.
3. **Risk Management (RISK)** — sizing, drawdown/daily-loss discipline, survival.
4. **Discipline / Consistency (DISC)** — rule adherence, routine, journaling, habit (also informed by Academy behavior: streaks, plan adherence).
5. **Challenge Readiness (CR)** — mastery of the *specific* challenge ruleset + composite of the above weighted for passing.

CR is not independent; it is a weighted composite plus challenge-rule-specific competence (see 6.6). Dimension scores are persisted per user and versioned over time (Progress Dashboard, Module 24).

---

## 6.1 Free Trading Diagnostic — purpose & strategic role

- **Purpose.** Convert anonymous visitors into identified, scored, routed leads in under three minutes — the Academy's primary lead-generation surface.
- **Strategic role.** Top of funnel. It is deliberately free, fast, valuable, and shareable. Its output (a personalized scorecard + prescribed path) is the hook that turns a curious visitor into a Free User with a reason to return tomorrow.

## 6.2 Diagnostic — objectives
- Score the visitor across the five dimensions quickly and credibly.
- Produce an honest readiness band and a *specific* next action (prescribed path + first swipe deck).
- Capture identity (account creation) at the moment of peak motivation (right before revealing the full scorecard).
- Be re-takeable to re-baseline and to show improvement over time.

## 6.3 Diagnostic — input design (the question set)
A mixed-format instrument (built on Atlas Assessment 11) of ~15–25 adaptive items, weighted toward judgment over trivia:
- **TA items:** chart/image questions (Atlas image/chart item types) and swipe-style "valid/invalid setup" items (Vol 07).
- **PSY items:** scenario questions ("You're down 2% on the day and see a setup — what do you do?") with behaviorally-scored options.
- **RISK items:** sizing/drawdown scenarios; "given these rules, what's the max you risk per trade?"
- **DISC items:** self-reported habits (journaling, plan use, rule adherence) — lightly weighted and cross-checked against later behavior.
- **Challenge-awareness items:** do they understand drawdown, daily loss, profit target, time limits?

**Adaptivity (v1 = lightweight):** branch difficulty by early answers so beginners aren't crushed and advanced traders aren't bored. Full IRT-style adaptivity is a future enhancement; v1 uses banded difficulty selection.

## 6.4 Diagnostic — scoring model
- Each item maps to one or more dimensions with a weight and a correct/behavioral-credit key (defined in the item bank).
- Dimension score = weighted percentage of credit earned on that dimension's items, normalized 0–100.
- Confidence flag per dimension based on number of items answered (low item count → "indicative, retake to refine").
- The diagnostic does **not** by itself set the Challenge Readiness band high; it produces a *starting* band that real practice/assessment must confirm (anti-gaming: you can't talk your way to Challenge Ready).
- Scoring is deterministic given answers + item-bank version (testable; see Vol 13).

## 6.5 Diagnostic — output, flow & dashboard
**Readiness bands (initial):** Beginner · Developing · Ready · Challenge Ready · Elite (shared with Readiness Engine, 6.7).

**User flow:**
1. Visitor clicks **Take the Free Trading Diagnostic** (homepage hero, ads).
2. Answers items (progress bar, 2–3 min, mobile-first).
3. **Identity gate:** account creation prompted to "unlock your full scorecard" at peak curiosity (just before results). (Auth via Atlas Supabase Auth.)
4. **Scorecard reveal:** radar/bar visual of the five dimensions, overall band, plain-language interpretation, and biggest gap highlighted.
5. **Prescription:** a recommended Learning Path (Vol 03) targeting the weakest dimension(s), a first swipe deck (Vol 07), and a "start your streak" nudge.
6. **Routing:** one-tap into the prescribed path; follow-up email/push (Atlas Notification 26) to return tomorrow.

**Diagnostic dashboard (post-completion, persists):** current band, five-dimension scorecard, date taken, "retake to re-baseline," and trend vs prior diagnostics.

## 6.6 Diagnostic — recommendation logic
Recommendation = f(weakest confident dimension, current stage, available content tagged to that dimension/stage, Vol 03.6). Tie-break toward the dimension most predictive of challenge failure (historically RISK and PSY). Always produce exactly one clear next action, never a menu.

## 6.7 Diagnostic — analytics & acceptance
- **Analytics.** Start rate, completion rate, identity-gate conversion (the key lead-gen metric), band distribution, prescription acceptance (did they start the recommended path?), retake rate, diagnostic→Day-2 return, diagnostic→eventual challenge conversion.
- **Acceptance (headline).** A visitor completes the diagnostic in ~3 minutes, creates an account at the identity gate, receives a five-dimension scorecard + a single prescribed next action, and is routed into it; scoring is deterministic and re-takeable; the diagnostic alone cannot grant a Challenge Ready band. (Vol 13 §FB-AC-Diagnostic.)

---

## 6.8 Challenge Readiness Engine — purpose & strategic role
- **Purpose.** Determine, honestly and from demonstrated competence, whether a trader is ready to attempt a funded challenge — and time the attributed hand-off to maximize pass probability.
- **Strategic role.** The conversion gate. It protects the trader (don't waste a fee unprepared), protects FundedBeyond's pass rates, and creates a high-intent, well-timed, attributed referral to `fundedbeyond.com`.

## 6.9 Readiness Engine — objectives
- Continuously compute the CR band from *demonstrated* signals, not self-report.
- Make readiness transparent: show the trader exactly what's strong, what's missing, and what to do.
- Gate the *prominence and confidence* of the challenge CTA by band — never hard-block a user, but only actively encourage the attempt at Challenge Ready+.
- Feed the conversion funnel (Vol 10) and pass-rate analytics (Vol 12).

## 6.10 Readiness Engine — inputs (demonstrated signals)
Computed from Academy activity, not opinion:
- **Assessment performance** (Vol 08): scores per dimension, recency-weighted.
- **Swipe accuracy** (Vol 07): rolling accuracy per dimension, especially risk/psychology/chart decks.
- **Program completion + gates** (Vol 03): which stages' competence gates are passed.
- **Challenge-rule mastery** (Module 9): comprehension of drawdown, daily loss, targets, time.
- **Simulated readiness review** (6.12): a structured rehearsal scored against challenge rules.
- **Discipline/behavior signals:** streak consistency, trading-plan submission & approval (Atlas Workflow 32), journaling habit.
- **Recency & decay:** stale competence decays; readiness reflects *current* state, encouraging continued practice.

## 6.11 Readiness Engine — scoring logic
- Each input maps to one or more of the five dimensions with weights (config-tunable, versioned).
- Dimension scores are recency-weighted rolling aggregates (recent demonstrated performance dominates).
- **CR composite** = weighted blend emphasizing RISK, PSY, and DISC (the historical drivers of challenge failure) + a mandatory **challenge-rule-mastery floor**: a trader cannot reach "Challenge Ready" without demonstrating rule mastery and passing the simulated review, regardless of TA brilliance.
- **Gating rule (anti-overconfidence):** the band can go *down* if performance decays or rule mastery lapses. Honesty over flattery (Vol 01 principle 4).
- Deterministic given inputs + weight-config version (testable).

## 6.12 Readiness levels & the simulated review
**Bands:** 
- **Beginner** — foundational gaps; far from ready.
- **Developing** — progressing; major gaps in ≥1 core dimension.
- **Ready** — competent across dimensions; not yet challenge-rule-proven.
- **Challenge Ready** — competent *and* rule-proven *and* passed the simulated review; the engine actively encourages the attempt.
- **Elite** — funded-trader-grade; sustained high performance.

**Simulated readiness review:** a structured, scenario-based rehearsal (built on Atlas Assessment 11 + scenario/swipe items) that mimics challenge conditions and rules: drawdown decisions, daily-loss discipline, target pacing, psychology under simulated pressure. Passing it is a hard requirement for the Challenge Ready band. (v1 is decision-scenario based; live trading-data integration is future, Vol 11.)

## 6.13 Readiness Engine — user experience (Challenge Readiness Center, Module 30)
1. Trader opens the Challenge Readiness Center.
2. Sees CR band + five-dimension scorecard + a **readiness checklist** (e.g., ✓ Risk assessment passed, ✓ 30-day streak, ✗ Simulated review not yet passed).
3. For each gap: a specific, one-tap action (the exact swipe deck / module / review to complete).
4. On reaching **Challenge Ready**: a confident confirmation ("You're prepared — here's why") with the proof, then a prominent **Start Your Challenge** CTA.
5. CTA = attributed outbound redirect to `fundedbeyond.com` (Vol 10). The Center never shows a checkout.

## 6.14 Readiness Engine — recommendations
Always converts gaps into the single highest-leverage next action (same logic family as 6.6, but driven by demonstrated-signal gaps and weighted toward the challenge-rule floor and the simulated review when those are the blockers).

## 6.15 Readiness Engine — CTA gating policy (critical)
- Below **Ready:** challenge CTA is de-emphasized / educational ("Here's the path to get ready"). Never pushy.
- **Ready:** CTA present but framed as "almost there — close these gaps."
- **Challenge Ready / Elite:** CTA prominent and encouraged.
- **Absolute rule:** the CTA is *always* an attributed outbound redirect; the engine influences *prominence and framing*, never gates a user out of clicking, and never processes a purchase (Vol 10).

## 6.16 Readiness Engine — analytics & acceptance
- **Analytics.** Band distribution & migration over time, checklist-gap completion rates, simulated-review pass rate, Readiness-Center→challenge-click, click→purchase (attributed), and the headline: **readiness band at time of purchase vs eventual pass rate** (validates the engine — Challenge Ready buyers should pass meaningfully more than under-prepared buyers).
- **Acceptance (headline).** CR band is computed only from demonstrated signals (assessments, swipe, gates, rule mastery, simulated review, discipline), can decrease on decay, requires the challenge-rule floor + simulated-review pass to reach Challenge Ready, surfaces transparent gaps with one-tap fixes, and gates only CTA prominence — never blocking the user and never processing a purchase. The engine's validity is monitored by correlating purchase-time band with pass rate. (Vol 13 §FB-AC-Readiness.)


---

# Volume 07 — Swipe Learning Engine

> The Academy's signature pedagogy and the engine of daily habit. Tinder-meets-Duolingo for traders. Implemented as an **Atlas Plugin/Extension (Engine 34)** plus a **swipe item type on Atlas Assessment (11)**, with content delivered via Atlas LMS (9) and progress feeding Gamification (13) and the Readiness Engine (Vol 06). No platform redesign — a new content/interaction type riding existing engines.

## 7.1 Purpose
Replace passive long-form consumption with rapid, binary, judgment-building practice that a trader can do in two minutes a day, forms a streak habit, and measurably sharpens the exact judgments that pass challenges: is this a valid setup, a good entry, the right risk decision, the disciplined behavior?

## 7.2 Objectives
- Build a **daily habit** (streaks) — the single biggest retention lever (Vol 09).
- Train **fast pattern judgment** across TA, RISK, and PSY dimensions.
- Feed **demonstrated-signal** scores into the Readiness Engine (Vol 06) — swipe accuracy is real evidence, not self-report.
- Be the most mobile-native, frictionless surface in the Academy (Vol 11).
- Be cheap to author at scale (weekly decks, Vol 03.5).

## 7.3 Swipe card types
Each card presents a stimulus and asks for a binary judgment; some support a third "skip/unsure."

| Card type | Stimulus | Right = | Left = | Dimension |
|-----------|----------|---------|--------|-----------|
| Setup validity | Chart/setup image | Valid setup | Invalid setup | TA |
| Entry quality | Chart with entry marked | Good entry | Bad entry | TA |
| Risk decision | Scenario (rules + situation) | Correct risk action | Incorrect | RISK |
| Psychology scenario | Behavioral scenario | Correct behavior | Incorrect behavior | PSY |
| Rule compliance | Challenge-rule situation | Compliant | Violation | CR/RISK |
| Concept check | Statement/definition | True | False | varies |

**Card anatomy:** stimulus (image/chart/text), the binary prompt, optional 2-second timer pressure (configurable per deck for "instinct" decks), and — after the swipe — **instant feedback**: correct/incorrect + a one-line explanation (the learning moment). Optional "explain more" links to the relevant lesson (Atlas LMS 9).

## 7.4 Deck design
- A **deck** = an ordered/shuffled set of cards tagged by dimension, stage, and difficulty.
- Decks are tagged so the recommendation system (Vol 06) can serve the deck targeting a user's weakest dimension.
- **Daily deck:** a short auto-assembled session (e.g., 10–15 cards) mixing the user's weak dimension with spaced-repetition of previously-missed cards.
- **Themed decks:** weekly fresh content (Vol 03.5), e.g., "This week's setups," "Daily-loss-limit dilemmas."
- Authoring: instructors/content team create cards/decks via the Academy authoring surface (built on Atlas LMS 9 + the plugin); cards reviewed via Atlas Workflow (32) before publish.

## 7.5 Interaction & UX
- **Gestures:** swipe right/left (or tap buttons for accessibility); optional swipe-up for "unsure/skip."
- **Feedback:** immediate, animated, with the explanation — the dopamine + learning loop.
- **Session end:** score, accuracy by dimension, streak status, XP earned, and "one more deck?" nudge.
- **Mobile-first:** thumb-friendly, offline-capable where feasible (Atlas mobile offline), sub-second card transitions.
- **Accessibility:** button equivalents for all gestures; screen-reader labels for stimuli; no color-only correctness signals.

## 7.6 Spaced repetition & adaptivity
- Missed cards re-enter the queue at increasing intervals (lightweight SRS in v1).
- Daily deck difficulty adapts to rolling accuracy: sustained high accuracy raises difficulty; struggling lowers it and injects remedial cards + links to the underlying lesson.
- Anti-gaming: rapid random swiping is detected (too-fast + low-accuracy patterns) and de-weighted in readiness scoring; such sessions still count for streak only if minimum-attention thresholds are met.

## 7.7 Scoring & readiness contribution
- Per-card: correct/incorrect, response time.
- Per-deck/session: accuracy by dimension.
- **Rolling per-dimension swipe accuracy** is a demonstrated-signal input to the Readiness Engine (Vol 06.10), recency-weighted.
- Streaks and XP feed Gamification (Vol 09). Swipe accuracy thresholds participate in stage gates (Vol 03.1).

## 7.8 Habit & streak loop
- A completed daily session (min N cards meeting attention thresholds) maintains the **streak** (Vol 09).
- Streak-at-risk notifications (Atlas Automation 31 + Notification 26): "2 minutes to keep your 14-day streak."
- Streak freeze / repair mechanics (Gamification, Vol 09) to avoid demotivating single misses.

## 7.9 User stories
- As a beginner, I do a 2-minute setup-validity deck daily and start recognizing good setups instinctively.
- As an advanced trader, I drill daily-loss-limit dilemmas under a 2-second timer to harden discipline.
- As a busy trader, I keep my streak from my phone in line at a coffee shop.
- As the Readiness Engine, I use this user's rolling risk-deck accuracy as evidence toward their RISK score.

## 7.10 User flows
- **Daily loop:** open Academy/app → "Daily Swipe" prompt → auto-assembled deck → swipe + instant feedback → session summary (accuracy/streak/XP) → recommended next deck or back to dashboard.
- **Targeted practice:** dashboard recommends "Your risk judgment is your biggest gap — drill it" → risk deck → readiness RISK score updates.
- **Remedial:** repeated misses on a card type → deck injects remedial cards + offers the underlying lesson.

## 7.11 Analytics requirements
- Daily active swipers, sessions/user/day, cards/session, completion rate.
- Accuracy by dimension and by deck; difficulty calibration health.
- Streak distribution and streak-driven retention.
- Swipe accuracy → readiness-band advancement correlation.
- Swipe engagement → downstream challenge conversion & pass correlation (Vol 10/12).
- Anti-gaming flag rate.

## 7.12 Acceptance (headline)
A trader can complete a sub-2-minute daily swipe session on web or mobile with instant per-card feedback; sessions maintain a streak and award XP; rolling per-dimension swipe accuracy feeds the Readiness Engine as a demonstrated signal and participates in stage gates; decks are recommended by weakest dimension with spaced repetition of misses; rapid-random gaming is detected and de-weighted; and all of it rides Atlas Assessment/LMS/Gamification via the plugin without modifying platform internals. (Vol 13 §FB-AC-Swipe.)


---

# Volume 08 — Assessment Center & Certification Center

> Both ride Atlas engines: Assessment Center on Atlas Assessment (11), Certification Center on Atlas Certification (12). This volume defines the FundedBeyond *assessment design, question banks, scoring intent, and credential ladder* — not the platform grading/issuance machinery.

---

# Part A — Assessment Center

## 8.1 Purpose
Measure trading *judgment* (not trivia), feed the five readiness dimensions with demonstrated signals (Vol 06), and gate stage progression (Vol 03) honestly.

## 8.2 Objectives
- Assess across all five dimensions with realistic, scenario- and chart-based items.
- Produce dimension-mapped scores consumed by the Readiness Engine.
- Gate roadmap stages on demonstrated competence.
- Resist gaming and rote memorization.

## 8.3 Supported question types (on Atlas Assessment 11)
- **MCQ** (single answer)
- **Multi-select** (choose all that apply)
- **True/False**
- **Scenario-based** (situational judgment; behaviorally scored — partial credit possible)
- **Image-based** (interpret an image)
- **Chart-analysis** (mark/interpret structure, levels, setups on a chart)
- **Swipe assessments** (the Vol 07 swipe item type used in a graded, no-feedback-until-end mode)

FundedBeyond contributes the **question banks and scoring keys**; Atlas provides delivery, grading, attempts, timing, and anti-cheat (Atlas Assessment 11 + Proctoring optional).

## 8.4 Question banks & difficulty
- Banks organized by dimension (TA/PSY/RISK/DISC/CR) and by stage.
- Each item tagged: dimension(s), weight, difficulty, stage, and the learning objective it tests.
- Difficulty levels: Foundational · Intermediate · Advanced · Challenge-grade.
- Banks are large enough to randomize and to support retakes without rote memorization; items reviewed via Atlas Workflow (32).

## 8.5 Assessment types (configurations)
- **Diagnostic** (Vol 06) — mixed, adaptive-lite, ungated, identity-capturing.
- **Stage-gate assessments** — per roadmap stage; passing gates advancement (Vol 03.1).
- **Program assessments** — end-of-program competence checks tied to certifications (Part B).
- **Simulated readiness review** (Vol 06.12) — scenario-heavy, challenge-condition rehearsal; hard gate for Challenge Ready.
- **Practice quizzes** — ungated, formative, feed swipe-style spaced repetition.

## 8.6 Scoring & progression
- Items map to dimensions with weights; scoring is deterministic given answers + bank version.
- Scenario items support partial/behavioral credit per key.
- Results write recency-weighted into the five dimensions (Vol 06.10) and into stage-gate pass/fail.
- Retake policy: allowed with cooldowns and item randomization; readiness uses recency-weighted latest performance (no infinite-retry gaming — see anti-gaming below).
- **Anti-gaming:** item randomization from large banks, cooldowns, time limits, and (for high-stakes gates) optional Atlas Proctoring (Atlas Engine 14, L1) where appropriate. Suspiciously fast perfect runs are flagged.

## 8.7 User stories
- As a learner, my assessments test whether I'd make the right call on a real chart, not whether I memorized a definition.
- As a trader, passing a stage gate unlocks the next stage and visibly raises my readiness.
- As the Readiness Engine, I consume assessment results as recency-weighted dimension evidence.

## 8.8 User flows
- Stage gate: enter → mixed items → submit → score + dimension updates → pass (unlock next stage) or fail (targeted remediation recommendations, Vol 06.14).
- Simulated review: enter → challenge-condition scenarios → score → contributes hard gate to Challenge Ready (Vol 06.12).

## 8.9 Analytics
- Item difficulty/discrimination, bank health, score distributions.
- Stage-gate pass rates and retake patterns.
- Assessment performance → readiness lift → downstream conversion/pass correlation (Vol 10/12).
- Flagged-attempt rate (anti-gaming).

## 8.10 Acceptance (headline)
Assessments support all seven item types via Atlas; items are dimension-tagged with weighted, deterministic scoring; results write recency-weighted into the five readiness dimensions and gate roadmap stages; large randomized banks + cooldowns + optional proctoring resist gaming; and the simulated review is a hard gate for Challenge Ready. (Vol 13 §FB-AC-Assess.)

---

# Part B — Certification Center

## 8.11 Purpose
Issue verifiable, motivating credentials that mark genuine competence at each rung of the trader journey — trust artifacts for the trader and social proof for FundedBeyond.

## 8.12 Objectives
- A credential ladder mapped to the roadmap (Vol 03).
- Issuance strictly earned (assessment + program completion).
- Publicly verifiable; shareable; motivating; consent-aware for any public display.

## 8.13 The six certifications (on Atlas Certification 12)
| # | Certification | Earned by | Maps to stage |
|---|---------------|-----------|---------------|
| 1 | Trading Foundations | Beginner Program + Foundations assessment | Stage 1 |
| 2 | Risk Management | Risk Program + risk assessment + risk-swipe threshold | Stage 4 |
| 3 | Trading Psychology | Psychology Program + psychology scenario assessment | Stage 5 |
| 4 | Challenge Preparation | Challenge Prep Program + challenge-rule assessment | Stage 6 (entry) |
| 5 | Challenge Readiness | Challenge Ready band (Vol 06) incl. simulated-review pass | Stage 6 (exit) |
| 6 | Funded Trader | Confirmed funded status (inbound, Vol 10) + Funded Program | Stage 7 |

## 8.14 Issuance rules
- Each certification has explicit, demonstrated criteria (above). No criteria → no issuance (Atlas Certification enforces).
- **Challenge Readiness** issues only when the Readiness Engine reaches Challenge Ready (demonstrated-signal floor + simulated-review pass) — it cannot be bought or self-asserted.
- **Funded Trader** issues only on a verified inbound funded event (Vol 10) — it certifies a real outcome, protecting its credibility.
- Revocation: if funded status is revoked (inbound) or fraud detected, the credential is revoked and audited (Atlas Certification 12 + Audit 30).

## 8.15 Progression logic
Certifications form a visible ladder on the Trader Dashboard (Module 23) and roadmap (Module 3). Earning one often unlocks/encourages the next program. The ladder doubles as a motivation and status system feeding gamification (Vol 09) and Hall of Fame (Vol 09).

## 8.16 Verification
Each issued certificate carries a public, verifiable link/ID (Atlas Certification 12) so a trader can prove it externally (e.g., social, affiliate credibility). Verification page shows holder (per consent), credential, issue date, and validity/revocation status.

## 8.17 User stories
- As a trader, I earn a Challenge Readiness certificate that genuinely means I'm prepared.
- As a funded trader, my Funded Trader certificate is backed by a real outcome and verifiable.
- As an affiliate, my certifications lend me credibility I can verify publicly.

## 8.18 User flows
- Earn: meet criteria → Atlas issues → notification → appears on dashboard/profile → shareable/verifiable → next rung highlighted.
- Verify: anyone opens verification link → sees validity status.

## 8.19 Analytics
- Issuance counts and time-to-certification per credential.
- Share/verify rates.
- Certification attainment → conversion & funded correlation (Vol 10/12).
- Revocation rate.

## 8.20 Acceptance (headline)
Six roadmap-mapped certifications issue only on demonstrated criteria via Atlas Certification; Challenge Readiness requires the Readiness floor + simulated-review pass; Funded Trader requires a verified inbound funded event and is revocable; every certificate is publicly verifiable; and the ladder is visible and motivating. (Vol 13 §FB-AC-Cert.)


---

# Volume 09 — Community, Gamification & Hall of Fame

> All three ride Atlas: Community on Atlas Community (16) + Content Moderation (17); Gamification on Atlas Gamification (13); Hall of Fame on Community + inbound funded events (Vol 10). This volume defines the FundedBeyond *social architecture, status ladder, reward rules, and recognition* — not the platform forum/points machinery.

---

# Part A — Community

## 9.1 Purpose
Make the Academy a place traders belong, stay accountable, get fast answers, and see proof that funding is real — the retention and trust moat (Vol 01 principles 6–7).

## 9.2 Objectives
- Match every trader to peers at their band/stage.
- Manufacture accountability and momentum (study/challenge groups, cohorts, streak buddies).
- Ensure questions are answered fast (mentor incentives + moderation).
- Convert social proof into diagnostic starts and challenge conversions.

## 9.3 Community architecture (the status ladder)
Community structure mirrors the trader journey, so belonging escalates with progress — a built-in status ladder:

| Space | Access | Purpose |
|-------|--------|---------|
| **Public Community** (Mod 15) | Readable by visitors (config); post = member | Trust, top-of-funnel, beginner Q&A, wins |
| **Private Community** (Mod 16) | Members, band-segmented | Higher-signal, focused discussion |
| **Study Groups** (Mod 17) | Cohort around a program/stage | Accountability, shared streaks, check-ins |
| **Challenge Groups** (Mod 18) | Auto-join on inbound challenge purchase | Support during the attempt |
| **Funded Trader Groups** (Mod 19) | Gated by confirmed funded status | Elite peer space, mentorship supply |
| **Mentorship Areas** | Mentors (funded/advanced) + mentees | Guidance, 1-to-many help |
| **AMA Sessions** | Scheduled, often funded traders/coaches | Access + inspiration |
| **Community Challenges** | Open or cohort | Engagement spikes, leaderboards |

Membership moves *up* the ladder automatically as readiness band rises and as inbound events (purchase, funded) fire — so the community itself rewards progress.

## 9.4 Mentorship
- Funded/advanced traders can become mentors (trained via Funded Program mentor module, Mod 10).
- Mentor recognition + gamified rewards (XP, badges, Hall of Fame eligibility) for answering questions and running AMAs.
- "No question unanswered > X hours" SLA backed by moderator routing + mentor incentives (Atlas Automation 31 routes unanswered questions).

## 9.5 AMAs & community challenges
- **AMAs:** scheduled via Atlas Event Management (20) / Webinar (19); recorded to Resource Library (Mod 22).
- **Community challenges:** time-boxed competitions (e.g., "Spot the invalid setup," cohort streak races) with leaderboards (9.9) — educational/demo only, never touching real challenge accounts.

## 9.6 Moderation & safety
- Atlas Content Moderation (17): report/flag queues, moderator tools, audit.
- FundedBeyond rules: no signal-selling/pump schemes, no unverified profit claims, no off-platform challenge sales, compliant language around trading risk. Violations → moderation workflow.
- Funded/profit claims surfaced publicly must be backed by inbound funded events or editorial verification (ties to Hall of Fame consent, 9.12).

## 9.7 Community user stories
- As a beginner, I find a study group at my level that keeps me consistent.
- As a challenge trader, I'm auto-placed with others mid-attempt for support.
- As a funded trader, I get an elite room and recognition for mentoring.

## 9.8 Community flows
- Onboarding: diagnostic → band → recommended groups → join.
- Escalation: readiness rises / inbound event → auto-promoted to next ladder space + notified.
- Support: ask question → routed → answered within SLA → answerer earns XP.

---

# Part B — Gamification

## 9.9 Purpose & model
Drive daily habit and journey progression with mechanics tuned to *trader development* — not vanity. Built on Atlas Gamification (13).

**Mechanics:**
- **XP** — earned for swipe sessions, lessons, assessments passed, plan submissions, helping others, attendance. Weighted toward *deliberate practice and contribution*.
- **Levels** — overall trader level derived from XP; cosmetic + unlocks (e.g., profile flair, advanced decks).
- **Streaks** — daily-practice streak (Vol 07.8) with freeze/repair to avoid demotivation; the headline retention mechanic.
- **Achievements/Badges** — milestone and behavior badges (examples below).
- **Milestones** — journey-stage milestones (e.g., "Reached Ready," "Plan Approved," "Challenge Ready," "Funded").
- **Leaderboards** — opt-in, segmented (by band/group/cohort/time window) to keep them motivating not demoralizing; reset monthly (Vol 03.5).
- **Community challenges** — time-boxed competitions (9.5).

**Example achievements:** 7/30/100-day Streak · First Plan Approved · Risk Master (risk assessment + risk-swipe threshold) · Mind of Steel (psychology mastery) · Sharp Eye (chart-swipe accuracy) · Challenge Ready · Funded Trader · Mentor · Helping Hand (answers given).

## 9.10 Anti-vanity & integrity principles
- XP rewards *learning behavior and contribution*, not mere clicking; swipe anti-gaming (Vol 7.6) prevents farming.
- Leaderboards are opt-in and segmented to avoid discouraging beginners.
- No gamification mechanic ever implies trading-profit competition or encourages over-trading; framing is about *development*, not P&L.

## 9.11 Gamification analytics & stories
- **Analytics.** Streak distribution & streak→retention, XP/level distribution, achievement earn rates, leaderboard opt-in/engagement, gamification engagement → readiness lift & conversion correlation.
- **Stories.** As a trader, my streak makes me show up daily; my badges mark real competence; the monthly leaderboard in my band keeps me competitive without being crushed.

---

# Part C — Funded Trader Hall of Fame

## 9.12 Purpose
Showcase real funded traders and top performers to build trust, inspire, and convert — the Academy's most powerful social proof (Vol 01 principle 6).

## 9.13 Objectives & content
- **Recently Funded Traders** — auto-populated from inbound funded events (Vol 10), consent-gated.
- **Success Stories & Interviews** — editorial features (monthly cadence, Vol 03.5).
- **Case Studies** — journey breakdowns ("from Beginner band to Funded in N weeks").
- **Monthly Top Performers** — by *development* metrics (readiness lift, streaks, contribution) — never by trading P&L.
- **Community Recognition** — mentor/helper spotlights.

## 9.14 Trust & consent rules (critical)
- Any *funded* claim displayed publicly must be backed by a verified inbound funded event (Vol 10) — no unverified income claims.
- Display is **consent-gated**: traders opt in to be featured; PII shown only per consent (Atlas privacy controls).
- Compliant framing around results and risk (no guarantees, no income promises) per 9.6.

## 9.15 Hall of Fame flows, analytics, stories
- **Flows.** Funded event (inbound) → eligibility + consent request → on consent, featured. Visitor browses Hall of Fame → story → diagnostic/CTA.
- **Analytics.** Views, view→diagnostic conversion, view→challenge-click, feature opt-in rate, story engagement.
- **Stories.** As a visitor, seeing verified funded traders makes me trust the path and take the diagnostic. As a funded trader, being featured is a reward I'm proud to share.

## 9.16 Acceptance (headline)
Community spaces form a journey-mirroring status ladder with automatic promotion on readiness/inbound events and an answered-within-SLA norm; gamification rewards deliberate practice and contribution (never P&L or over-trading) with habit-forming streaks and segmented opt-in leaderboards; and the Hall of Fame displays only consent-gated, inbound-verified funded claims as social proof that measurably drives diagnostics and conversions. (Vol 13 §FB-AC-Community, §FB-AC-Gamification, §FB-AC-HallOfFame.)


---

# Volume 10 — Analytics, Challenge Conversion & CTA Strategy

> The business heart of the Academy. The Academy earns its keep not through its own revenue but through **attributed challenge conversions** and **pass-rate lift**. This requires measuring a funnel that *crosses the boundary* into `fundedbeyond.com`. This volume defines the analytics surfaces, the challenge-conversion funnel, the CTA strategy, and the bidirectional attribution handshake. Built on Atlas Enterprise Analytics (29), the Atlas event taxonomy, and Atlas Integration (27). The Academy never processes a challenge purchase (Vol 00 non-negotiable 1).

## 10.1 Analytics surfaces (consumers)
All ride Atlas Analytics (29); FundedBeyond defines the events and dashboards.

- **Student Analytics** (for the trader) — readiness trajectory, dimension trends, streaks, assessment history, certifications (Modules 23/24).
- **Instructor Analytics** — content effectiveness (readiness lift, completion, swipe accuracy per asset), where learners struggle, question-bank health.
- **Community Analytics** — group activity, answer SLA, mentor contribution, engagement→retention.
- **Business Analytics** — acquisition, activation (diagnostic), engagement, retention, and the headline **Challenge Conversion** funnel (10.3).

## 10.2 Event taxonomy (FundedBeyond-specific, on Atlas event bus)
Key events (each carries user id, journey stage, readiness band, timestamp, tenant context):
`diagnostic.started/completed`, `account.created`, `path.started`, `swipe.session.completed`, `assessment.completed`, `stage.gate.passed`, `readiness.band.changed`, `certification.issued`, `readiness.center.viewed`, `challenge.cta.clicked` (with attribution token), and the **inbound** events `challenge.purchased`, `challenge.passed`, `challenge.failed`, `trader.funded`, `funded.revoked`.

## 10.3 The Challenge Conversion funnel (the headline metric)
The funnel the entire Academy is optimized for:

```
Visitor
  → Academy User (account.created)
    → Assessment / Diagnostic taken
      → Challenge Ready (readiness.band.changed = Challenge Ready)
        → Challenge Purchase Click (challenge.cta.clicked)  ── boundary ──▶ fundedbeyond.com
          → Challenge Purchase (challenge.purchased, INBOUND)
            → Challenge Pass (challenge.passed, INBOUND)
              → Funded Trader (trader.funded, INBOUND)
```

Steps up to the click happen *inside* the Academy. Steps after the click happen *on `fundedbeyond.com` / Match-Trader* and return via the inbound handshake (10.6). Only by joining both halves can the Academy prove its business value.

## 10.4 CTA strategy
- **Challenge CTAs:** "Start Your Challenge," "Become Funded," "Explore Challenge Programs," "View Funding Plans."
- **Placement:** stage-aware (Vol 02) — prominent for Challenge Ready/Elite (Vol 06.15), educational/de-emphasized below Ready. Surfaced on homepage (stage-gated), Trader Dashboard, Challenge Readiness Center, post-certification moments, and relevant emails/push.
- **Behavior:** **every challenge CTA is an outbound redirect to `fundedbeyond.com`** carrying an attribution payload (10.5). No CTA ever opens a checkout, collects payment, or creates a trading account inside the Academy.
- **Non-challenge CTAs** (take diagnostic, start path, do daily swipe, join group) drive internal progression and are placed by next-best-action (Modules 23/06).

## 10.5 Outbound attribution (Academy → fundedbeyond.com)
On `challenge.cta.clicked`, the Academy redirects to `fundedbeyond.com` with an **attribution token** containing (privacy-respecting): an Academy attribution id (pseudonymous, mappable internally), readiness band at click, journey stage, source surface, campaign/UTM, and a signed timestamp. The token lets the main ecosystem (a) attribute the eventual purchase back to the Academy and (b) pass readiness context downstream. Token is signed/verifiable; no sensitive PII in the URL.

## 10.6 Inbound conversion handshake (fundedbeyond.com → Academy)
The main ecosystem reports lifecycle events back via **Atlas Integration (27)** (secure, signed webhooks):
- `challenge.purchased` (with attribution id) → close the click→purchase loop; set stage = Challenge Buyer; auto-join Challenge Group (Mod 18); unlock challenge-support content.
- `challenge.passed` / `challenge.failed` → stage update; celebrate or route to recovery program.
- `trader.funded` → stage = Funded Trader; unlock Funded Program/Group/Certification; Hall of Fame eligibility (consent).
- `funded.revoked` → revoke Funded credential/access (Vol 08.14).

This handshake is **product logic the Academy defines**; the transport (signed webhooks, retries, idempotency) is provided by Atlas Integration (27). The Academy stores only what it needs for attribution and journey state — never trading account data or challenge billing (Vol 00).

## 10.7 Attribution model & analytics
- **Attribution:** click→purchase joined by attribution id; supports last-touch (default) and assisted/multi-touch views (diagnostic-assisted, content-assisted) so the Academy can show both "directly sourced" and "influenced" conversions.
- **Headline business analytics:** diagnostic completion rate, activation rate, Ready-band rate, Ready→click rate, click→purchase rate (attributed), purchase→pass rate, pass→funded rate, and the validity metric **readiness-band-at-purchase → pass-rate** (Vol 06.16).
- **Cohort & content impact:** which programs/decks/certs most lift readiness and most correlate with downstream passing — drives quarterly content pruning (Vol 03.5).
- **Privacy:** funnel analytics use pseudonymous ids; PII handling per Atlas privacy/compliance (Atlas Vol 5). No trading P&L is ingested in v1.

## 10.8 User stories
- As the business, I see exactly how many funded traders the Academy sourced and influenced this quarter, with pass-rate proof.
- As a PM, I see that risk-swipe drilling correlates with higher pass rates, so I expand it.
- As a trader, my "Start Your Challenge" click takes me to `fundedbeyond.com` seamlessly and my journey continues there.

## 10.9 User flows
- **Conversion:** Challenge Ready → CTA click (emit event + token) → redirect to `fundedbeyond.com` → (external purchase) → inbound `challenge.purchased` → loop closed, stage updated, Challenge Group joined.
- **Pass/funded:** inbound `challenge.passed`/`trader.funded` → stage updates, unlocks, Hall of Fame eligibility, certification.

## 10.10 Acceptance (headline)
The Academy measures the full Visitor→Funded funnel including externally-completed steps; every challenge CTA is an outbound attributed redirect to `fundedbeyond.com` and never a checkout; outbound clicks carry a signed, privacy-respecting attribution token; inbound purchase/pass/funded events arrive via Atlas Integration and update journey stage, unlocks, and credentials idempotently; attribution supports last-touch and assisted views; and the readiness-band-at-purchase→pass-rate metric is tracked to validate the Readiness Engine. (Vol 13 §FB-AC-Conversion, §FB-AC-CTA, §FB-AC-Analytics.)


---

# Volume 11 — Mobile Experience & Future Vision

> Mobile rides Atlas Mobile White Label (39) — the branded FundedBeyond Academy app on the shared Atlas React Native/Expo codebase. This volume defines *what the Academy prioritizes on mobile* and the *future product vision*, not mobile platform engineering (that is Atlas Vol 7).

---

# Part A — Mobile Experience

## 11.1 Purpose
Deliver the daily-habit Academy where traders actually are — their phones. Mobile is the home of the streak: swipe, practice, community glance, and notifications.

## 11.2 Objectives
- Make the **daily swipe + streak** loop frictionless and delightful on mobile.
- Keep learners progressing with bite-size lessons and micro-assessments on the go.
- Keep the community in their pocket (groups, answers, recognition).
- Drive return visits via well-timed notifications without being spammy.

## 11.3 Mobile feature priorities (what's first-class)
| Priority | Feature | Notes |
|----------|---------|-------|
| 1 | **Swipe Learning** (Vol 07) | The hero mobile experience; thumb-native; offline-capable where feasible (Atlas mobile offline) |
| 1 | **Streaks & daily prompt** | Habit loop; streak-at-risk push (Vol 7.8) |
| 2 | **Learning** | Short lessons, video (provider-hosted), micro-assessments |
| 2 | **Assessments** | Stage gates and practice quizzes |
| 2 | **Community** | Read/post, groups, answers, recognition |
| 2 | **Notifications** | Streak reminders, answers to your question, new decks, readiness changes, stage-aware nudges (Atlas Notification 26) |
| 3 | **Progress tracking** | Readiness scorecard, trends, certifications, dashboard (Modules 23/24) |
| 3 | **Readiness Center + CTA** | Challenge Ready surfacing; CTA remains an outbound attributed redirect to `fundedbeyond.com` (Vol 10) |

## 11.4 Mobile UX principles
- Habit-first home: open the app → daily swipe prompt + streak front and center.
- Sub-2-minute sessions; everything thumb-reachable.
- Notifications are stage-aware, valuable, and rate-limited; deep-link straight to the action.
- Offline swipe + sync where the platform supports it; graceful degradation otherwise.
- Accessibility parity with web (button equivalents for swipe, screen-reader support).

## 11.5 Mobile user stories
- As a trader, I do my daily swipe on the train and keep my streak.
- As a learner, I get a push that my question was answered and tap straight into the thread.
- As a Challenge Ready trader, my phone tells me I'm ready and one tap takes me to start (externally).

## 11.6 Mobile user flows
- **Daily habit:** push ("keep your streak") → open → swipe deck → summary → done.
- **Learn anywhere:** open → continue program → short lesson + micro-quiz → progress synced.
- **Community:** open → group activity → reply → earn XP.

## 11.7 Mobile analytics
Mobile DAU/MAU, mobile swipe sessions/user, push opt-in & CTR, mobile streak retention, mobile vs web engagement split, mobile contribution to readiness lift and conversion (Vol 10).

## 11.8 Mobile acceptance (headline)
The branded Academy app (on Atlas Mobile White Label 39) makes the swipe+streak daily loop first-class and offline-capable where feasible, surfaces learning/assessment/community/progress, sends stage-aware deep-linked notifications, and keeps the challenge CTA as an outbound attributed redirect — at accessibility parity with web. (Vol 13 §FB-AC-Mobile.)

---

# Part B — Future Vision

> Vision only — product direction, **not** implementation. These shape future architecture decisions but are explicitly out of scope for v1 build.

## 11.9 Trading Journal Integration (flagship future capability)
**Vision.** Connect a trader's *real* trading activity to the Academy so development and readiness are grounded in actual behavior, not just simulated judgment.

- **Potential sources:** Match-Trader, TradeLocker, MetaTrader, cTrader.
- **Purpose:** performance analysis and trader development — turn real trades into readiness signals (actual risk adherence, drawdown discipline, consistency), personalized coaching, and far more accurate Challenge Readiness scoring (Vol 06 would gain a powerful demonstrated-signal source).
- **Product direction:** read-only ingestion of trade history/metrics → journaling, pattern detection (over-trading, revenge trading, rule breaches), and readiness-dimension updates from real behavior. The Academy would *analyze*, never *execute* — no order placement, no account management (those remain outside the Academy, Vol 00).
- **Boundary preserved:** even with journal integration, the Academy still never sells challenges or manages trading accounts; it consumes trade *data* for development only, via Atlas Integration (27) when built.

## 11.10 Other future directions (vision)
- **Live trade-data readiness scoring** feeding Vol 06 (replaces/augments simulated review with real evidence).
- **AI trading coach** (on Atlas AI Layer 40, human-reviewed) — personalized feedback on journaled trades and study plans.
- **Deeper personalization** — fully adaptive (IRT) diagnostics and curricula.
- **Expanded credentials & partner recognition** as the funded-trader community grows.

## 11.11 Future acceptance (vision-level)
Future capabilities (trading-journal integration, live readiness scoring, AI coaching) are designed to plug into Atlas via Integration (27) and the AI Layer (40), to deepen *development and readiness* using real behavior, and to do so **without** breaching the core boundary: the Academy never executes trades, manages accounts, or sells challenges. (Vol 13 §FB-AC-FutureVision.)


---

# Volume 12 — Success Metrics & Launch Roadmap

> How the Academy proves it works, and the order in which it is built. The launch roadmap maps onto the Atlas platform roadmap (Atlas Vol 13): the Academy can only light up a capability once the Atlas engine it rides exists. FundedBeyond Academy is Atlas Tenant #1, so its Phase 1 coincides with Atlas Phase 1.

---

# Part A — Success Metrics

Metrics are grouped, but the Academy is ultimately judged on the **business/conversion** tier — everything else is leading indicators of it.

## 12.1 Educational metrics
- Readiness-band advancement rate (users moving up bands over time).
- Per-dimension readiness lift (TA/PSY/RISK/DISC).
- Stage-gate pass rates; program completion (secondary to readiness lift).
- Certification attainment counts and time-to-certification.
- Assessment & swipe accuracy improvement over time.

## 12.2 Engagement metrics
- Diagnostic completion rate and identity-gate conversion (the activation metric).
- DAU/MAU and the **daily swipe / streak** metrics (streak length distribution, streak-driven retention).
- Sessions/user, time-in-app, mobile vs web split.
- Day-1 / Day-7 / Day-30 retention.

## 12.3 Community metrics
- Group membership and active participation rate.
- Answer SLA (% questions answered within target window).
- Mentor contribution; AMA/event attendance.
- Community participation → retention & conversion lift.

## 12.4 Business metrics (the tier that matters)
- **Challenge conversion metrics:** Ready→click rate, click→purchase rate (attributed), and total **attributed challenge purchases** (directly sourced + assisted).
- **Challenge readiness metrics:** % of active users reaching Challenge Ready; readiness-band distribution; time-to-Challenge-Ready.
- **Challenge pass-rate metrics:** purchase→pass rate overall, and **segmented by readiness band at purchase** (the Readiness Engine validity metric, Vol 06.16) — the proof the Academy raises pass rates.
- **Funded trader metrics:** pass→funded rate, total funded traders sourced/influenced by the Academy, funded-trader retention (30/60/90d), mentor conversion.
- **Flywheel metrics:** referral/affiliate-attributed diagnostics and conversions; Hall-of-Fame→diagnostic conversion.

## 12.5 The one-number framing
If the Academy reports a single number to FundedBeyond leadership, it is: **attributed funded traders produced per period**, with **pass-rate-by-readiness-band** as the supporting proof that the development (not just the funnel) is what's working.

---

# Part B — Academy Launch Roadmap

> Sequenced by dependency on Atlas engines and by funnel logic: stand up the lead-gen and core development loop first, then conversion measurement, then community/retention depth, then advocacy and future bets.

## 12.6 Phase 0 — Tenant stand-up (depends on Atlas Phase 0–1)
- Provision FundedBeyond Academy as Atlas Tenant #1: branding, theme, `academy.fundedbeyond.com` (Atlas 2/7/8); roles; auth (Atlas Supabase).
- Configure base content structures (Atlas LMS 9), Learning Paths (10), Assessment (11), Certification (12), Community (16), Notification (26), Analytics (29).
- **Exit:** the Academy renders branded and a test user can sign up, see a course, and post in community.

## 12.7 Phase 1 — Lead-gen + core development loop (MVP)
The minimum that delivers the Academy's core promise.
- **Free Trading Diagnostic** (Vol 06) live — the top-of-funnel hook + identity capture.
- **Swipe Learning Engine** (Vol 07) live — the daily habit + streaks (the retention core).
- **Trader Career Roadmap** + Beginner/Intermediate programs (Vol 03) + stage gates (Vol 08).
- **Five-dimension readiness scoring** + Trader/Progress Dashboards (Modules 23/24).
- **Core certifications** (Foundations, Risk, Psychology) (Vol 08).
- **Public + private community + study groups** (Vol 09); base gamification (XP/streaks/badges).
- **Challenge CTAs as outbound attributed redirects** + outbound attribution token (Vol 10).
- **Exit:** a visitor can diagnose → get a path → build a streak → take assessments → see readiness rise → and (if Ready) click an attributed challenge CTA to `fundedbeyond.com`.

## 12.8 Phase 2 — Conversion engine + readiness depth
- **Challenge Readiness Engine** full depth incl. **simulated readiness review** + Challenge Readiness Center (Vol 06, Module 30).
- **Inbound conversion handshake** via Atlas Integration (27): `challenge.purchased/passed/funded` → stage updates, Challenge Groups (Mod 18), unlocks (Vol 10).
- **Challenge Preparation Program** + Challenge Readiness & Challenge Prep certifications (Vol 08).
- **Full Challenge Conversion funnel analytics** incl. readiness-band→pass-rate (Vol 10/12.4).
- **Advanced + Psychology + Risk programs** complete.
- **Exit:** the Academy can prove attributed conversions and pass-rate-by-band; challenge traders are supported end-to-end.

## 12.9 Phase 3 — Retention, community depth & mobile habit
- **Funded Trader Program/Group/Certification** + **Hall of Fame** (inbound-verified, consent-gated) (Vol 09).
- **Mobile app** habit loop first-class (Vol 11) on Atlas Mobile White Label (39).
- **Webinar/Event centers, AMAs, community challenges, leaderboards** at full cadence (Vol 03.5/09).
- Mentorship program live.
- **Exit:** funded traders are retained and recognized; mobile drives daily streaks; community is self-sustaining.

## 12.10 Phase 4 — Advocacy & future bets
- **Referral + Affiliate Education Centers** with attributed links (Modules 27/28; Atlas Integration 27).
- Fully adaptive diagnostics/curricula; expanded content effectiveness optimization.
- **Future vision exploration** (Vol 11): Trading Journal Integration, live readiness scoring, AI coach (Atlas AI Layer 40, human-reviewed) — as vision matures into scoped builds.
- **Exit:** the flywheel turns — funded traders refer; the Academy compounds its own top-of-funnel.

## 12.11 Acceptance (headline)
The Academy is judged on attributed funded traders and pass-rate-by-readiness-band, supported by educational/engagement/community leading indicators; and it launches in dependency order — tenant stand-up → lead-gen + development loop → conversion engine + readiness depth → retention/community/mobile → advocacy/future — each phase gated by the Atlas engines it rides. (Vol 13 §FB-AC-Metrics, §FB-AC-Launch.)


---

# Volume 13 — Acceptance Criteria

> The definition of done for FundedBeyond Academy. Each criterion is testable and maps to the `§FB-AC-*` codes referenced throughout. Platform-level guarantees (isolation, RBAC, payments infra, grading machinery, mobile shell) are covered by the **Atlas** acceptance criteria and are assumed; the criteria below cover only **FundedBeyond product behavior**. `[Phase]` notes when a criterion first applies (Vol 12 launch roadmap).

---

## Cross-cutting

### §FB-AC-Journey
- Every user has a derived **journey stage** (Vol 02.1) computed from Academy signals + inbound events; stage is queryable and drives homepage, recommendations, and CTA prominence.
- Stage transitions emit analytics events; the full Visitor→Funded→Ambassador funnel is measurable, including externally-completed steps via the conversion handshake (§FB-AC-Conversion).

### §FB-AC-Home
- The homepage layout and primary CTA differ by journey stage; visitors are funneled to the Free Diagnostic; logged-in users see a clear next-best-action.
- Any challenge CTA on the homepage is an outbound attributed redirect (§FB-AC-CTA) — never a checkout.

---

## Development core

### §FB-AC-Diagnostic [Phase 1]
- A visitor completes the Free Trading Diagnostic in ~3 minutes, mobile-first.
- An account is created at the identity gate **before** full results are revealed.
- Output is a five-dimension scorecard + overall band + exactly one prescribed next action, into which the user is routed.
- Scoring is deterministic given answers + item-bank version; the diagnostic is re-takeable; the diagnostic **alone cannot** grant a Challenge Ready band.

### §FB-AC-Readiness [Phase 2]
- The Challenge Readiness band is computed **only** from demonstrated signals (assessments, swipe accuracy, stage gates, challenge-rule mastery, simulated review, discipline/streaks) — never self-report alone.
- The band can **decrease** on competence/recency decay.
- Reaching **Challenge Ready** requires the challenge-rule-mastery floor **and** a passed simulated readiness review, regardless of other strengths.
- The engine surfaces transparent gaps with one-tap fixes and gates only CTA **prominence**, never blocking a user, never processing a purchase.
- Engine validity is monitored via readiness-band-at-purchase → pass-rate correlation.

### §FB-AC-ReadinessCenter [Phase 2]
- The Challenge Readiness Center shows band + scorecard + checklist + gap actions; on Challenge Ready it shows a prominent **Start Your Challenge** CTA that is an outbound attributed redirect to `fundedbeyond.com`.
- The Center never exposes a checkout, payment, or trading-account creation.

### §FB-AC-Swipe [Phase 1]
- A trader completes a sub-2-minute daily swipe session (web or mobile) with instant per-card feedback and explanation.
- Sessions maintain a streak and award XP; rolling per-dimension swipe accuracy feeds the Readiness Engine and participates in stage gates.
- Decks are recommended by weakest dimension with spaced repetition of missed cards; rapid-random gaming is detected and de-weighted from readiness.
- Implemented via Atlas Plugin/Extension + Assessment item type without modifying platform internals.

### §FB-AC-Roadmap [Phase 1]
- The Trader Career Roadmap renders as a 7-stage gated visual path with current stage, progress, and the next competence gate always visible.
- Stage advancement requires demonstrated competence (assessment/swipe/readiness), not mere completion.

### §FB-AC-Content [Phase 1]
- Every content asset carries stage, readiness-dimension, and persona tags driving recommendations.
- Content **effectiveness** (readiness lift, conversion correlation) is measured — not just consumption — and feeds quarterly pruning.

### §FB-AC-Paths [Phase 1]
- Learning paths render program sequences and the roadmap on Atlas Learning Path (10); stages gate on competence; the next gate is always shown.

### §FB-AC-Catalog [Phase 1]
- The catalog reflects roadmap lock state and dimension tags; search returns only Academy (tenant-scoped) content via Atlas Search (28).

---

## Programs

### §FB-AC-ProgBeg [Phase 1]
- Completing the Beginner Program + passing its gate advances the readiness band and unlocks Stage 2.

### §FB-AC-ProgInt [Phase 1]
- Trading-plan submission (reviewed via Atlas Workflow 32) + strategy assessment gate Stage 3→4.

### §FB-AC-ProgAdv [Phase 2]
- Risk assessment pass + consistency checklist gate entry to Challenge Readiness.

### §FB-AC-ProgPsy [Phase 2]
- Psychology assessment + scenario-swipe threshold set the readiness PSY score.

### §FB-AC-ProgRisk [Phase 2]
- Risk assessment + risk-scenario swipe threshold set the readiness RISK score.

### §FB-AC-ProgPrep [Phase 2]
- The Challenge Preparation Program contributes to the Challenge Ready band and **never** exposes a purchase flow.

### §FB-AC-ProgFunded [Phase 3]
- The Funded Trader Program unlocks **only** on a confirmed inbound funded status and drives funded-retention metrics.

---

## Assessment & certification

### §FB-AC-Assess [Phase 1]
- All seven item types (MCQ, multi-select, true/false, scenario, image, chart-analysis, swipe) are supported via Atlas Assessment (11).
- Items are dimension-tagged with weighted, deterministic scoring; results write recency-weighted into the five readiness dimensions and gate roadmap stages.
- Large randomized banks + cooldowns + optional Atlas proctoring resist gaming; the simulated review is a hard gate for Challenge Ready.

### §FB-AC-Cert [Phase 1 core / Phase 2–3 advanced]
- Six roadmap-mapped certifications issue **only** on demonstrated criteria via Atlas Certification (12).
- Challenge Readiness cert requires the Readiness floor + simulated-review pass; it cannot be bought or self-asserted.
- Funded Trader cert requires a verified inbound funded event and is revocable on `funded.revoked`.
- Every certificate is publicly verifiable.

---

## Community, gamification, recognition

### §FB-AC-Community [Phase 1]
- Community spaces form a journey-mirroring status ladder; users are auto-promoted to the next space as readiness band rises and on inbound events.
- The Community Hub recommends groups by stage/band; an answered-within-SLA norm is enforced via moderation routing + mentor incentives.

### §FB-AC-PubCommunity [Phase 1]
- The public space is readable pre-signup (per config), converts readers to accounts, and gates posting to members.

### §FB-AC-PrivCommunity [Phase 1]
- Access is gated by stage/band and membership moves with readiness.

### §FB-AC-StudyGroups [Phase 1]
- Study-group members show measurably higher streak/completion than the solo baseline; shared goals and check-ins run via Atlas Automation/Notification.

### §FB-AC-ChallengeGroups [Phase 2]
- Membership is auto-granted on the inbound `challenge.purchased` event; the group ingests **no** trading data (self-reported check-ins only in v1) and correlates with pass-rate analysis.

### §FB-AC-FundedGroups [Phase 3]
- Access is strictly gated by confirmed inbound funded status.

### §FB-AC-Achievements [Phase 1]
- Achievements/badges map to meaningful trader behaviors (practice, gates, contribution, milestones), not vanity; awards are idempotent.

### §FB-AC-Gamification [Phase 1]
- XP rewards deliberate practice and contribution (not P&L, never encouraging over-trading); streaks (with freeze/repair) drive retention; leaderboards are opt-in and segmented by band/cohort.

### §FB-AC-HallOfFame [Phase 3]
- Funded claims displayed publicly are backed by verified inbound funded events; all features are consent-gated; framing is compliant (no income guarantees); Hall-of-Fame→diagnostic conversion is tracked.

### §FB-AC-Webinar [Phase 3]
- Recurring + topical webinars run via Atlas Webinar/Live (19/18); recordings archive to the Resource Library; clinics target Stage 6.

### §FB-AC-Events [Phase 3]
- Events run via Atlas Event Management (20); no event touches real challenge accounts/infrastructure.

### §FB-AC-Library [Phase 1]
- Resources are dimension/stage-tagged, searchable via Atlas Search (28), and usage is tracked.

---

## Advocacy

### §FB-AC-Referral [Phase 4]
- The Referral Education Center teaches effective, compliant referring and issues personal referral links carrying attribution; referred visitors/diagnostics/conversions are traceable via the handshake (§FB-AC-Conversion). The Academy pays no challenge commissions itself (handled externally).

### §FB-AC-Affiliate [Phase 4]
- Affiliate education gates access to promotional assets behind curriculum + Affiliate Certification; promotion uses attributed links; affiliate-attributed conversions are measurable; affiliate payouts are handled by the main ecosystem, not the Academy.

---

## Dashboards

### §FB-AC-Dashboard [Phase 1]
- The Trader Dashboard is stage-aware and always presents a clear single next-best-action (readiness, streak, next gate, recommended content/swipe, stage CTA).

### §FB-AC-Progress [Phase 1]
- The Progress Dashboard shows per-dimension readiness trajectory, assessment/swipe history, streaks, and certifications over time.

---

## Conversion, CTA, analytics

### §FB-AC-CTA [Phase 1]
- **Every** challenge CTA ("Start Your Challenge," "Become Funded," "Explore Challenge Programs," "View Funding Plans") is an outbound redirect to `fundedbeyond.com` carrying a signed, privacy-respecting attribution token.
- No CTA ever opens a checkout, collects payment, or creates a trading account inside the Academy.
- CTA prominence is stage/band-aware (de-emphasized below Ready; prominent at Challenge Ready+).

### §FB-AC-Conversion [Phase 2]
- The full Visitor→Funded funnel is measurable, including externally-completed steps.
- Inbound `challenge.purchased/passed/funded`/`funded.revoked` events arrive via Atlas Integration (27) and **idempotently** update journey stage, group membership, unlocks, and credentials.
- Outbound click→inbound purchase is joined by attribution id (last-touch + assisted views available).

### §FB-AC-Analytics [Phase 1→2]
- Student/Instructor/Community/Business analytics surfaces exist on Atlas Analytics (29) with FundedBeyond events.
- The Challenge Conversion funnel and the readiness-band-at-purchase→pass-rate validity metric are tracked; funnel analytics use pseudonymous ids; no trading P&L is ingested in v1.

---

## Mobile & future

### §FB-AC-Mobile [Phase 3]
- The branded Academy app (Atlas Mobile White Label 39) makes the swipe+streak daily loop first-class and offline-capable where feasible; surfaces learning/assessment/community/progress; sends stage-aware deep-linked notifications; keeps the challenge CTA an outbound attributed redirect; and matches web accessibility.

### §FB-AC-FutureVision [vision only]
- Future capabilities (Trading Journal Integration with Match-Trader/TradeLocker/MetaTrader/cTrader, live readiness scoring, AI coaching) are specified to plug into Atlas via Integration (27)/AI Layer (40), to deepen development/readiness from real behavior, and to **never** breach the core boundary: the Academy never executes trades, manages accounts, or sells challenges.

### §FB-AC-Metrics
- The Academy reports attributed funded traders per period as its headline, with pass-rate-by-readiness-band as supporting proof, plus educational/engagement/community leading indicators.

### §FB-AC-Launch
- The Academy launches in dependency order (tenant stand-up → lead-gen + development loop → conversion engine + readiness depth → retention/community/mobile → advocacy/future), each phase gated by the Atlas engines it rides.

---

## 13.1 Acceptance of this PRD
This PRD is complete when: all 30 core modules and the four flagship engines (Diagnostic, Readiness, Swipe, Conversion) have the required sections (Purpose, Objectives, Functional Requirements, User Stories, User Flows, Analytics, Acceptance Criteria); every capability either references the Atlas engine it rides or defines genuinely FundedBeyond-specific logic (never redesigning Atlas); the absolute boundary (the Academy never sells challenges; all challenge CTAs are attributed outbound redirects) holds in every relevant criterion; and the document is usable as the source of truth by founders, PMs, designers, developers, Claude Code, and Cursor.
