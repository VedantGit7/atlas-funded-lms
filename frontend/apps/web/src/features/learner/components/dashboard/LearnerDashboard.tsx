"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Clock,
  Crown,
  Flame,
  Gem,
  Lightbulb,
  Lock,
  Medal,
  Megaphone,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCurrency } from "../../../currency/CurrencyProvider";
import { scoreBandLabel, scoreColor } from "./dashboard-model";
import { HeroSceneMount, ProgressBar, RadialProgress, Reveal } from "./dashboard-ui";
import { LearnerPromoSliderCarousel } from "./LearnerPromoSliderCarousel";
import { LearnerEventsCountdown } from "./LearnerEventsCountdown";

export type LearnerDashboardData = {
  displayName: string | null;
  readiness: { scorePercent: number; label: string; color: string; energy: number } | null;
  level: number | null;
  xpTotal: number | null;
  weeklyXp: number | null;
  xpIntoLevel: number | null;
  xpForNextLevel: number | null;
  levelProgressPercent: number;
  streakCount: number | null;
  streakFreezes: number | null;
  badgeCount: number | null;
  badges: Array<{ id: string; name: string; icon: string | null }>;
  trend: Array<{ label: string; value: number }>;
  mastery: Array<{ key: string; label: string; score: number }>;
  courses: Array<{ id: string; courseId: string; title: string; status: string }>;
  queue: Array<{ id: string; title: string; meta: string; kind: "due" | "next" }>;
  certificates: Array<{
    id: string;
    name: string;
    credentialId: string;
    status: string;
    issuedAt: string;
    verificationUrl: string;
  }>;
  recommended: Array<{ id: string; title: string; reason: string; href: string }>;
  announcement: { id: string; title: string; at: string } | null;
  legalCopy: { disclaimer: string | null } | null;
};

const cardClass = "rounded-2xl border border-border bg-card shadow-sm";
const sectionTitleClass = "text-lg font-bold tracking-tight text-foreground";

/**
 * Map a badge to a real, recognizable icon based on its admin-defined iconKey
 * (or name). Keys mirror common gamification conventions (Material Symbols
 * names like `bolt`, `verified_user`, `military_tech`) plus everyday synonyms,
 * so each badge shows meaningful iconography instead of a generic placeholder.
 */
const BADGE_VISUALS: Array<{ match: RegExp; Icon: LucideIcon; color: string; filled: boolean }> = [
  { match: /fire|flame|streak|hot|blaze/, Icon: Flame, color: "#f97316", filled: true },
  {
    match: /bolt|zap|fast|speed|quick|start|sprint|lightning/,
    Icon: Zap,
    color: "#f59e0b",
    filled: true,
  },
  {
    match: /shield|verified|perfect|guard|defend|secure|consisten/,
    Icon: BadgeCheck,
    color: "#3b82f6",
    filled: false,
  },
  {
    match: /crown|king|queen|champion|elite|legend|royal/,
    Icon: Crown,
    color: "#a855f7",
    filled: true,
  },
  {
    match: /medal|military|tech|master|honou?r|expert|pro/,
    Icon: Medal,
    color: "#8b5cf6",
    filled: true,
  },
  {
    match: /rocket|launch|boost|momentum|rising|breakout/,
    Icon: Rocket,
    color: "#06b6d4",
    filled: false,
  },
  {
    match: /target|goal|accuracy|precision|sharp|bullseye|focus/,
    Icon: Target,
    color: "#ef4444",
    filled: false,
  },
  { match: /gem|diamond|premium|treasure|jewel|rare/, Icon: Gem, color: "#14b8a6", filled: false },
  {
    match: /trophy|win|victory|first|top|winner|complete/,
    Icon: Trophy,
    color: "#eab308",
    filled: true,
  },
  {
    match: /star|favou?rite|excellent|outstanding|five/,
    Icon: Star,
    color: "#22c55e",
    filled: true,
  },
  { match: /award|achiev|badge|milestone|reward/, Icon: Award, color: "#6366f1", filled: false },
];

function badgeVisual(
  icon: string | null,
  name: string,
): { Icon: LucideIcon; color: string; filled: boolean } {
  const haystack = `${icon ?? ""} ${name}`.toLowerCase();
  for (const v of BADGE_VISUALS) {
    if (v.match.test(haystack)) return { Icon: v.Icon, color: v.color, filled: v.filled };
  }
  return { Icon: Medal, color: "#f59e0b", filled: true };
}

/** Fallback suggestions shown before the recommender has personalised picks. */
const STARTER_SUGGESTIONS: Array<{
  href: string;
  reason: string;
  title: string;
  Icon: LucideIcon;
}> = [
  {
    href: "/courses",
    reason: "Popular with new learners",
    title: "Browse the course catalog",
    Icon: BookOpen,
  },
  {
    href: "/roadmap",
    reason: "Build your plan",
    title: "Follow a guided mastery path",
    Icon: Target,
  },
  {
    href: "/diagnostic/me",
    reason: "Know where you stand",
    title: "Take a skills diagnostic",
    Icon: ClipboardCheck,
  },
  { href: "/practice", reason: "Sharpen daily", title: "Practice with quick drills", Icon: Zap },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((then - Date.now()) / 60000);
  const abs = Math.abs(mins);
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return fmt.format(mins, "minute");
  if (abs < 1440) return fmt.format(Math.round(mins / 60), "hour");
  return fmt.format(Math.round(mins / 1440), "day");
}

export function LearnerDashboard({
  data,
  personalizedSection,
}: {
  data: LearnerDashboardData;
  personalizedSection?: ReactNode;
}) {
  const greeting = data.displayName?.trim() ? `Welcome back, ${data.displayName}` : "Welcome back";
  const coreColor = data.readiness?.color ?? "#6aa9ff";
  const { rates } = useCurrency();
  const usdInr = typeof rates["INR"] === "number" ? rates["INR"] : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24 md:pb-8">
      {/* Header + status strip */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.streakCount
              ? "You're on a roll. Keep your daily streak alive."
              : "Pick up where you left off."}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
          <StatChip
            icon={<Flame className="h-4 w-4 text-[var(--warning)]" fill="currentColor" />}
            value={`${String(data.streakCount ?? 0)} Days`}
          />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <StatChip
            icon={<Trophy className="h-4 w-4 text-primary" />}
            value={`Level ${String(data.level ?? 1)}`}
          />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <StatChip
            icon={<Zap className="h-4 w-4 text-primary" fill="currentColor" />}
            value={`${(data.xpTotal ?? 0).toLocaleString()} XP`}
          />
        </div>
      </header>

      <Reveal>
        <LearnerPromoSliderCarousel />
      </Reveal>

      <Reveal>
        <LearnerEventsCountdown />
      </Reveal>

      {/* Announcement */}
      {data.announcement ? (
        <Reveal>
          <div className={`${cardClass} flex items-center justify-between gap-3 p-4`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Latest update
                </span>
                <p className="truncate text-sm font-semibold text-foreground">
                  {data.announcement.title}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime(data.announcement.at)}
            </span>
          </div>
        </Reveal>
      ) : null}

      {/* HERO: Mastery Core */}
      <Reveal>
        <section
          className={`${cardClass} relative overflow-hidden`}
          style={{
            background: `radial-gradient(120% 120% at 85% 15%, ${coreColor}1f, transparent 55%), var(--card)`,
          }}
        >
          <div className="grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Market pulse &amp; your readiness
              </div>
              <div>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
                    {data.readiness ? `${String(Math.round(data.readiness.scorePercent))}%` : "—"}
                  </span>
                  {data.readiness ? (
                    <span
                      className="mb-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                      style={{ background: `${coreColor}22`, color: coreColor }}
                    >
                      {data.readiness.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {data.legalCopy?.disclaimer ??
                    "Your overall readiness across every skill you're building. It grows as you learn."}
                </p>
              </div>

              {/* Level progress */}
              <div className="max-w-md space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">Level {data.level ?? 1}</span>
                  <span className="text-muted-foreground">
                    {data.xpForNextLevel != null && data.xpIntoLevel != null
                      ? `${data.xpIntoLevel.toLocaleString()} / ${data.xpForNextLevel.toLocaleString()} XP`
                      : "Max level"}
                  </span>
                </div>
                <ProgressBar value={data.levelProgressPercent} />
                {data.weeklyXp ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" />+
                    {data.weeklyXp.toLocaleString()} XP this week
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="relative isolate z-0 h-56 w-full overflow-hidden rounded-2xl border border-white/10 sm:h-72"
              style={{ background: "radial-gradient(120% 120% at 70% 15%, #111c33, #060a14)" }}
            >
              <HeroSceneMount color={coreColor} usdInr={usdInr} />
            </div>
          </div>
        </section>
      </Reveal>

      {personalizedSection ? <Reveal>{personalizedSection}</Reveal> : null}

      {/* Continue Learning + Today's Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={sectionTitleClass}>Continue Learning</h2>
              <Link href="/courses" className="text-sm font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <EmptyCard
                icon={<BookOpen className="h-6 w-6" />}
                title="No active courses yet"
                body="Browse the catalog and enroll to start building your mastery."
                cta={{ label: "Browse courses", href: "/courses" }}
              />
            ) : (
              <div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {data.courses.map((course) => (
                  <div
                    key={course.id}
                    className={`${cardClass} group w-[300px] shrink-0 snap-start overflow-hidden transition-shadow hover:shadow-md`}
                  >
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                      <BookOpen className="h-9 w-9 text-primary/70" />
                    </div>
                    <div className="space-y-3 p-4">
                      <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-foreground">
                        {course.title}
                      </h3>
                      <Link
                        href={`/courses/${course.courseId}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 motion-safe:active:scale-[0.98]"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Resume
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        <Reveal delay={0.05}>
          <section>
            <h2 className={`${sectionTitleClass} mb-3`}>Today&apos;s Queue</h2>
            <div className="space-y-3">
              {data.queue.length === 0 ? (
                <div className={`${cardClass} flex items-center gap-3 p-4`}>
                  <ShieldCheck className="h-5 w-5 text-[var(--success)]" />
                  <p className="text-sm text-muted-foreground">
                    You&apos;re all caught up. Nice work.
                  </p>
                </div>
              ) : (
                data.queue.map((item) => (
                  <div
                    key={item.id}
                    className={`${cardClass} flex items-start gap-3 border-l-4 p-4`}
                    style={{
                      borderLeftColor:
                        item.kind === "due" ? "var(--destructive)" : "var(--primary)",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background:
                          item.kind === "due"
                            ? "color-mix(in srgb, var(--destructive) 15%, transparent)"
                            : "color-mix(in srgb, var(--primary) 12%, transparent)",
                        color: item.kind === "due" ? "var(--destructive)" : "var(--primary)",
                      }}
                    >
                      {item.kind === "due" ? (
                        <ClipboardCheck className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wide"
                        style={{
                          color: item.kind === "due" ? "var(--destructive)" : "var(--primary)",
                        }}
                      >
                        {item.kind === "due" ? "Active quest" : "Up next"}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                  </div>
                ))
              )}
              <div className={`${cardClass} flex items-start gap-3 bg-[var(--muted)] p-4`}>
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Study tip
                  </p>
                  <p className="mt-1 text-sm italic text-foreground/80">
                    Reviewing a concept just before you sleep meaningfully improves recall.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </div>

      {/* Progress & Mastery */}
      <Reveal>
        <section className={`${cardClass} p-6`}>
          <div className="mb-6">
            <h2 className={sectionTitleClass}>Progress &amp; Mastery</h2>
            <p className="text-sm text-muted-foreground">
              Your proficiency across the skills you&apos;re developing.
            </p>
          </div>

          {data.mastery.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.mastery.slice(0, 6).map((skill) => {
                const color = scoreColor(skill.score);
                return (
                  <div
                    key={skill.key}
                    className="flex flex-col items-center rounded-xl border border-border bg-muted/40 p-5 text-center"
                  >
                    <RadialProgress value={skill.score} color={color}>
                      <span className="text-xl font-extrabold text-foreground">
                        {Math.round(skill.score)}%
                      </span>
                    </RadialProgress>
                    <h4 className="mt-3 text-sm font-bold text-foreground">{skill.label}</h4>
                    <span
                      className="mt-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: `${color}1f`, color }}
                    >
                      {scoreBandLabel(skill.score)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUp className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-bold text-foreground">
                Your mastery map is taking shape
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Complete lessons and diagnostics and your skill proficiency across each domain will
                appear here.
              </p>
              <Link
                href="/diagnostic/me"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Take a diagnostic
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Skill growth trend */}
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Skill growth trend
            </p>
            {data.trend.length >= 2 ? (
              <div className="flex h-28 items-end justify-between gap-2">
                {data.trend.map((point, index) => (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary"
                        style={{
                          height: `${String(Math.max(6, point.value))}%`,
                          opacity: 0.35 + (index / data.trend.length) * 0.6,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {point.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative flex h-28 items-end justify-between gap-2">
                {[40, 52, 46, 63, 58, 74, 82].map((h, index) => (
                  <div key={index} className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-muted-foreground/25"
                      style={{ height: `${String(h)}%` }}
                    />
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                    Keep learning to chart your growth
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* Achievements & Streak + Certificates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <section className={`${cardClass} h-full p-6`}>
            <h2 className={`${sectionTitleClass} mb-6`}>Achievements &amp; Streak</h2>
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-grow space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">Level {data.level ?? 1}</span>
                  <span className="text-muted-foreground">
                    {(data.xpTotal ?? 0).toLocaleString()} XP total
                  </span>
                </div>
                <ProgressBar value={data.levelProgressPercent} />
                {data.badges.length > 0 ? (
                  <div>
                    <p className="mb-2 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Badges earned
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {data.badges.slice(0, 3).map((badge) => {
                        const { Icon, color, filled } = badgeVisual(badge.icon, badge.name);
                        return (
                          <div
                            key={badge.id}
                            className="flex flex-col items-center rounded-xl bg-[var(--muted)] p-3 text-center"
                          >
                            <span
                              className="mb-1.5 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
                              style={{ boxShadow: `inset 0 0 0 1px ${color}22` }}
                            >
                              <Icon
                                className="h-5 w-5"
                                style={{ color }}
                                fill={filled ? "currentColor" : "none"}
                              />
                            </span>
                            <span className="line-clamp-2 text-[11px] font-bold text-foreground">
                              {badge.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <MiniStat
                      icon={<Zap className="h-5 w-5 text-[var(--warning)]" fill="currentColor" />}
                      value={String(data.weeklyXp ?? 0)}
                      label="XP this week"
                    />
                    <MiniStat
                      icon={<Award className="h-5 w-5 text-primary" fill="currentColor" />}
                      value={String(data.badgeCount ?? 0)}
                      label="Badges"
                    />
                    <MiniStat
                      icon={<Star className="h-5 w-5 text-[var(--success)]" fill="currentColor" />}
                      value={String(data.mastery.length)}
                      label="Skills"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--warning)]/30 bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] p-6 text-center lg:w-52">
                <Flame className="h-12 w-12 text-[var(--warning)]" fill="currentColor" />
                <div className="mt-1 text-5xl font-extrabold text-foreground">
                  {data.streakCount ?? 0}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--warning)]">
                  Day streak
                </div>
                {data.streakFreezes ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-3 py-1 text-xs font-bold text-[var(--warning)]">
                    <Snowflake className="h-3.5 w-3.5" />
                    {data.streakFreezes} freeze{data.streakFreezes === 1 ? "" : "s"} banked
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-5">
          <section className={`${cardClass} h-full p-6`}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className={sectionTitleClass}>Certificates</h2>
              <Link
                href="/certificates"
                className="text-sm font-semibold text-primary hover:underline"
              >
                All
              </Link>
            </div>
            <div className="space-y-3">
              {data.certificates.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-10 text-center">
                  <Lock className="mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">No certificates yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Complete a mastery path to earn your first.
                  </p>
                </div>
              ) : (
                data.certificates.slice(0, 3).map((cert) => (
                  <a
                    key={cert.id}
                    href={cert.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-primary"
                  >
                    <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded border border-border bg-card text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Award className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-grow">
                      <h4 className="truncate text-sm font-bold text-foreground">{cert.name}</h4>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{cert.credentialId}</span>
                        <span>{formatDate(cert.issuedAt)}</span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold uppercase"
                      style={
                        cert.status === "issued"
                          ? {
                              background: "color-mix(in srgb, var(--success) 16%, transparent)",
                              color: "var(--success)",
                            }
                          : { background: "var(--muted)", color: "var(--muted-foreground)" }
                      }
                    >
                      {cert.status}
                    </span>
                  </a>
                ))
              )}
              {data.certificates.length > 0 ? (
                <div className="flex items-center gap-4 rounded-xl border border-dashed border-border p-4 opacity-70">
                  <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-foreground">Next credential</h4>
                    <p className="text-xs text-muted-foreground">
                      Locked. Complete a mastery path to unlock.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </Reveal>
      </div>

      {/* Recommended */}
      <Reveal>
        <section>
          <h2 className={`${sectionTitleClass} mb-3`}>Recommended for you</h2>
          {data.recommended.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.recommended.slice(0, 4).map((rec) => (
                <Link
                  key={rec.id}
                  href={rec.href}
                  className={`${cardClass} group overflow-hidden transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                    <Sparkles className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="p-4">
                    <span className="mb-1 block text-[11px] font-bold text-primary">
                      {rec.reason}
                    </span>
                    <h3 className="mb-3 line-clamp-2 text-sm font-bold text-foreground">
                      {rec.title}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all group-hover:gap-2.5">
                      Explore
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STARTER_SUGGESTIONS.map((rec) => (
                <Link
                  key={rec.href}
                  href={rec.href}
                  className={`${cardClass} group overflow-hidden transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                    <rec.Icon className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="p-4">
                    <span className="mb-1 block text-[11px] font-bold text-primary">
                      {rec.reason}
                    </span>
                    <h3 className="mb-3 line-clamp-2 text-sm font-bold text-foreground">
                      {rec.title}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all group-hover:gap-2.5">
                      Explore
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function StatChip({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5 px-3 text-sm font-bold text-foreground">
      {icon}
      {value}
    </span>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[var(--muted)] p-3 text-center">
      <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
        {icon}
      </span>
      <span className="text-base font-extrabold text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-3 p-10 text-center`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <Link
        href={cta.href}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {cta.label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
