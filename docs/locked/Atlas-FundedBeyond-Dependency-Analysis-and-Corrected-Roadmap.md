# Atlas LMS × FundedBeyond Academy — Dependency Analysis & Corrected Roadmap

**Goal:** FundedBeyond Academy v1 must launch without forking Atlas LMS.

**Sources:** Atlas LMS Master PRD v3.0 · FundedBeyond Academy Master PRD v1.0 · Architecture Review Report.

**Bottom line:** Both PRDs are individually strong, but FundedBeyond's flagship features (Diagnostic, Swipe, five-dimension scoring) are assigned to Atlas's **Plugin/Extension Engine (34)**, which Atlas does not build until **Phase 4** — three phases after FundedBeyond needs it in **Phase 1**. As written, tenant #1 cannot launch without forking Atlas or stalling. This is the Architecture Review's critical risk **C3 / §10**. The corrected roadmap below resolves it by promoting a minimal, generic, first-party extensibility-and-scoring capability into Phase 1.

---

## 1. Every dependency between FundedBeyond and Atlas

Derived from FundedBeyond's capability-mapping table (Vol 00) plus its module/AC cross-references. "FB needs" = the phase FundedBeyond's launch roadmap (Vol 12) requires it. "Atlas ships" = Atlas's roadmap (Vol 13).

| FundedBeyond need | Atlas engine | FB needs | Atlas ships | Status |
|---|---|---|---|---|
| Branding / theme / `academy.fundedbeyond.com` | White Label (2), Theme (7), Domain Mgmt (8) | P0–1 | P1 | OK |
| Auth, roles, permissions | Role & Permission (3) + Supabase Auth | P0 | P0 | OK |
| Tenant stand-up, zero-code 2nd tenant | Tenant Provisioning (38) | P0–1 | P1 | OK |
| Courses / modules / lessons / video | LMS (9) | P1 | P1 | OK |
| Roadmap / program sequencing / stage gates | Learning Path (10) | P1 | P1 | OK |
| Quizzes, exams, banks, grading, attempts | Assessment (11) | P1 | P1 | OK |
| **Swipe as a new assessment item type** | Assessment (11) item-type extension | **P1** | **none — item types are fixed** | **FORK RISK** |
| Certificates, issuance, verification | Certification (12) | P1 | P1 | OK |
| XP / badges / streaks / leaderboards | Gamification (13) | P1 | P1 | OK |
| Forums, groups, posts, moderation | Community (16), Content Moderation (17) | P1 | P1 | OK |
| Optional anti-gaming on high-stakes gates | Proctoring (14) L1 | P1 | P1 | OK |
| Email / in-app notifications | Notification (26) | P1 | P1 | OK |
| Streak nudges, completion→cert rules | Automation (31) | P1 | P1 | OK |
| Trading-plan + swipe-card review→publish | Workflow (32) | P1 | P1 | OK |
| Search across content / Resource Library | Search (28) | P1 | P1 | OK |
| Dashboards & event analytics | Enterprise Analytics (29) | P1 | P1 | OK |
| **Five-dimension scoring substrate** (TA/PSY/RISK/DISC/CR; recency-weighted aggregation, decay, versioned config) | *No Atlas engine exists* — assumed to ride Plugin (34) | **P1** | **P4 (and only as a host, not the capability)** | **MISSING + INVERSION** |
| **Diagnostic + Swipe + Readiness net-new logic** | Plugin / Extension (34) | **P1** | **P4** | **INVERSION (3 phases)** |
| Push / SMS / WhatsApp channels | Notification (26) expanded | P2–3 | P2 | OK |
| Inbound `challenge.purchased/passed/funded` handshake | Integration (27) | P2 | P2 | OK |
| Live sessions / webinars / events | Live (18), Webinar (19), Event (20) | P3 | P2 | OK (earlier) |
| Branded mobile app | Mobile White Label (39) | P3 | P3 | OK |
| Referral / Affiliate education centers | Plugin (34) first-party extension points | P4 | P4 | OK (once 34 exists) |
| AI coach (human-reviewed) | AI Layer (40) | P4 | P4 | OK |
| Academy paid tiers | Commerce (21–25) | out of scope v1 | P1 | N/A (challenges sold externally) |

---

## 2. Every dependency inversion

An inversion = FundedBeyond requires a capability *earlier* than Atlas delivers it. There are three, sharing one root cause.

**Inversion 1 — Plugin/Extension Engine (34): FB Phase 1 vs Atlas Phase 4.**
FundedBeyond non-negotiable #6 and Vol 06/07 mandate that the Diagnostic, Readiness, and Swipe engines are built *as Atlas plugins* "without modifying platform internals." But Engine 34 is explicitly deferred to Atlas Phase 4 (Vol 13.6, §13.9). The launch tenant's entire differentiating layer has no host to run in at launch. Headline defect (Review C3).

**Inversion 2 — Five-dimension scoring engine: FB Phase 1 vs Atlas "never."**
The shared scoring substrate (Vol 06.0) — per-item dimension tagging, weighted *cross-assessment* aggregation, recency-weighted rolling aggregates, time-decay, a versioned scoring-config store, banded outputs — is **not** Assessment (11) configuration, as the Review establishes in §10. Atlas has no engine that provides it at any phase; it was implicitly folded into the Phase-4 plugin layer. Even if Engine 34 shipped in Phase 1, the scoring capability itself still would not exist. Simultaneously a missing engine and an inversion.

**Inversion 3 — Swipe item type on Assessment (11): FB Phase 1 vs Atlas "no extension point."**
Vol 07 and §FB-AC-Swipe require a *swipe item type* registered on Atlas Assessment. Atlas Assessment FR1 ships a fixed item-type list (MCQ, T/F, fill-blank, etc.) with no item-type registry or extension mechanism, and that engine ships in Phase 1. Adding the swipe type therefore means editing Assessment core — a fork — unless Atlas exposes a pluggable item-type registry. The capability FB needs at P1 is not provided at P1 without modifying internals.

**Root cause (all three):** net-new Academy intelligence was assigned to the extensibility layer, and Atlas builds extensibility last.

**Not inverted (correctly sequenced):** Integration (27), Live (18/19/20), Mobile White Label (39), and AI Layer (40) all land in Atlas at or before the FundedBeyond phase that needs them.

---

## 3. Every engine FundedBeyond requires before Atlas provides it

Exactly three, all needed in FundedBeyond Phase 1 (MVP):

1. **Plugin / Extension Engine (34)** — required P1, provided P4.
2. **A generic Competency & Scoring Engine** — required P1, does not exist in any Atlas phase.
3. **A pluggable Assessment item-type registry** (subset of 34, applied to Engine 11) — required P1, no extension point exists.

---

## 4. Corrected roadmap

**Fix strategy (Architecture Review recommendation #3):** stop treating FundedBeyond's intelligence as a deferred third-party plugin. Promote a minimal, generic, first-party extensibility-and-scoring capability into Phase 1 so the Academy consumes generic Atlas engines and never forks. The full third-party plugin sandbox + marketplace stay in Phase 4. Phase 0 also absorbs the Review's blocking correctness fixes (C1/C2/M1/M8): no feature can be trusted on a latently leaky isolation layer.

Changes versus the original PRDs are marked **[NEW]** / **[MOVED]**.

### Phase 0 — Platform Foundation + Correctness Gates (pre-tenant, pre-feature)
The substrate must be provably isolated *on the real stack* before any feature code.

- Repo, environments, CI/CD with security + coverage gates.
- Multi-Tenant (1) with **transaction-scoped `SET LOCAL` / `set_config(...,true)` RLS, proven against a pooled, production-like Postgres** — the Phase-0 exit gate **[MOVED, Review C1]**. Explicit connection pooler + per-tenant statement timeouts / query budgets **[NEW, C2]**.
- Role & Permission (3), default-deny, with **ownership/relationship checks folded into `can()`** **[NEW, M6]**.
- Supabase Auth; **host↔JWT tenant resolution decided and the membership gate made central + non-bypassable + audited**; global-vs-per-tenant identity decided **[NEW, M10]**.
- Audit Logging (30) + the event/outbox bus on a **real managed queue + worker runtime** (not "Postgres table or queue") **[NEW, M8]**.
- Tenant Configuration (5), Feature Flag (4).
- **Add Redis/Upstash to the stack** (permission cache, JWT revocation, rate limits, leaderboards, presence) **[NEW, M1]**.
- *Exit:* cross-tenant IDOR matrix green **under transaction pooling**; CI gates enforced.

### Phase 1 — FundedBeyond v1 Live on Generic Engines (the inversion-fix phase)
**Foundation / presentation:** White Label (2), Theme (7), Domain Mgmt (8) with **Cloudflare for SaaS** custom-hostname TLS **[NEW, M4]**; Tenant Provisioning (38).

**Learning core:** LMS (9), Learning Path (10), Assessment (11), Certification (12).

**The three inversions resolved here, as first-party generic engines:**

- **Competency & Scoring Engine [NEW]** — generic per-item dimension tagging, weighted cross-assessment aggregation, recency-weighting / decay, versioned scoring config, banded output. FundedBeyond *configures* its five dimensions (TA/PSY/RISK/DISC/CR); any future tenant gets the same engine. Resolves Inversion 2.
- **Minimal Extension Points + Assessment item-type registry [MOVED from P4]** — stable server hooks, UI slots, and a pluggable item-type registry so the **swipe item type** registers without touching Assessment core. Resolves Inversions 1 and 3. Third-party SDK / sandbox stays Phase 4.

**Integrity:** Proctoring (14) L1 + Exam Security basics (optional on high-stakes gates).

**Engagement:** Community (16) + Moderation (17); Gamification (13) baseline; Notification (26) email+in-app; Automation (31); Workflow (32) for course/plan/card review→publish; Search (28); **Redis-backed leaderboards / feeds / presence** so the daily loop is not dead **[NEW, §9]**.

**Analytics:** Enterprise Analytics (29) on **one canonical event pipeline (outbox → PostHog + warehouse)** **[NEW, M7]**; per-dimension dashboards read the Scoring engine. Data export from day one.

**Commerce:** FundedBeyond v1 sells nothing — only the **outbound attributed-redirect CTA + signed attribution token** (pure Academy app logic, no checkout). Payment Integration (21) lands for platform readiness but is off FB's critical path.

**FB app layer (no fork):** Free Trading Diagnostic, Swipe Learning, Trader Career Roadmap, Trader/Progress dashboards, core certifications, public/private community + study groups, CTAs. The free unauthenticated Diagnostic gets its own rate-limit / abuse model + anonymous→account merge **[NEW, §12]**.

- *Exit:* a visitor can diagnose → get a path → build a streak → assess → see readiness rise → (if Ready) click an attributed CTA; a 2nd tenant provisions on the same code; export works; **zero FundedBeyond-specific platform code**.

### Phase 2 — Conversion Engine + Multi-Tenant Hardening & Self-Serve
- Integration (27): idempotent inbound `challenge.purchased/passed/funded` handshake → journey stage, Challenge Groups, unlocks, credentials; webhooks / Zapier / CRM. With **attribution fallback + identity resolution + defined window** for the 20–40% of cross-domain conversions that otherwise go dark **[NEW, M7]**.
- **Challenge Readiness Engine** full depth + **simulated readiness review** (consumes the Phase-1 Scoring engine + Assessment scenario/swipe items) + Challenge Readiness Center; Challenge Prep program + certs.
- Full conversion-funnel analytics incl. readiness-band-at-purchase → pass-rate validity metric.
- SaaS Billing (37) + **central entitlement-enforcement gate** mirroring `can()` **[NEW, M5]**; Revenue Sharing (36); self-serve provisioning + super-admin console; Website Builder (6); Localization (33); Notification push / SMS / WhatsApp; Live / Webinar / Event (18/19/20).
- Commerce hardening: **default to Merchant-of-Record for tax** **[NEW, M2]**; subscriptions designed against **India RBI e-mandate** **[NEW, M3]**; per-adapter webhook replay protection **[NEW, M10]**; concrete KMS / vault for per-tenant credentials **[NEW, M9]**.

### Phase 3 — Integrity & Mobile Depth / Retention
- Proctoring L2 then L3 — consent / retention / BIPA design legally reviewed *before* building **[F3]**.
- Mobile White Label (39): runtime-branding shared app as default; **dedicated EAS builds only for tenants who bring their own developer account** (App Store 4.3 reality) **[NEW, C5]**. FundedBeyond branded app: swipe+streak loop first-class, with **offline swipe signals re-validated server-side** before they touch the readiness gate **[NEW, §6]**.
- Funded Trader Program / Group / Cert + Hall of Fame (inbound-verified, consent-gated); webinar / event / AMA cadence; mentorship.
- `tenant_id`-propagating distributed tracing **[NEW, F6]**.

### Phase 4 — Extensibility & Intelligence (now safe to open)
- **Full Plugin/Extension Engine (34)**: third-party SDK, sandboxing, signing, review — generalizing the first-party extension points already shipped in Phase 1.
- Marketplace (35).
- AI Layer (40) via AIProvider, **always human-gated through Workflow** (never auto-publishes); AI coach for FundedBeyond (human-reviewed).
- FundedBeyond Referral + Affiliate Education Centers (attributed links) as first-party extensions.

### Cross-cutting (every phase)
- Isolation / IDOR testing under pooling never pauses.
- Observability and performance budgets extend with each feature.
- **Legal counsel engaged before build** on the FundedBeyond challenge-funnel + "Readiness → go spend money" framing / disclaimers, and on proctoring biometrics — treated as gating, budgeted line items, not afterthoughts **[C4 / F3]**.

---

## The one structural change that makes the goal achievable

**Move the five-dimension scoring engine and a minimal extension / item-type registry from Phase 4 to Phase 1, as generic first-party Atlas engines.** That converts FundedBeyond's flagships from "fork or stall" into ordinary tenant configuration on generic engines — exactly what both PRDs' non-negotiables demand.
