"use client";

import Link from "next/link";

export function DiagnosticMockCard() {
  return (
    <div className="w-full max-w-[440px] shrink-0 max-[900px]:max-w-none">
      <div className="rounded-[18px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-[30px] shadow-[0_10px_40px_rgba(0,0,0,0.07)]">
        <div className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fba-tx3)]">
          Readiness Score
        </div>
        <div className="mb-2 flex items-baseline gap-1.5">
          <div className="text-[60px] font-extrabold leading-none text-[var(--fba-ind-tx)]">47</div>
          <div className="text-[22px] font-semibold leading-none text-[var(--fba-ind-tx)] opacity-75">
            /100
          </div>
        </div>
        <div className="mb-7 inline-flex items-center gap-[7px] rounded-[20px] border border-[color-mix(in_srgb,var(--fba-amb-tx)_35%,var(--fba-surf))] bg-[color-mix(in_srgb,var(--fba-amb-tx)_10%,var(--fba-surf))] px-3 py-[5px]">
          <div className="h-[5px] w-[5px] rounded-full bg-[var(--fba-amb-tx)]" />
          <span className="text-[11px] font-medium text-[var(--fba-tx)]">
            Below Average - Keep Going
          </span>
        </div>
        <div className="flex flex-col gap-[18px]">
          {[
            // `color` paints the bar, `textColor` prints the number. They were one
            // value, so making the percentage legible would have repainted the bar
            // as a side effect.
            {
              label: "Risk Management",
              pct: 30,
              color: "var(--fba-red)",
              textColor: "var(--fba-red-tx)",
            },
            {
              label: "Trading Psychology",
              pct: 62,
              color: "#d97706",
              textColor: "var(--fba-amb-tx)",
            },
            {
              label: "Technical Analysis",
              pct: 45,
              color: "#d97706",
              textColor: "var(--fba-amb-tx)",
            },
            {
              label: "Evaluation Rules",
              pct: 71,
              color: "var(--fba-grn)",
              textColor: "var(--fba-grn-tx)",
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-[7px] flex justify-between">
                <span className="text-xs font-medium text-[var(--fba-tx)]">{row.label}</span>
                <span className="text-xs font-bold" style={{ color: row.textColor }}>
                  {row.pct}%
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-[var(--fba-bg2)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-[22px] flex items-center justify-between border-t border-[var(--fba-bdr)] pt-[18px]">
          <span className="text-xs font-medium leading-[1.4] text-[var(--fba-tx2)]">
            Personalized study plan ready
          </span>
          <span className="cursor-pointer text-xs font-bold text-[var(--fba-ind-tx)]">
            View Report →
          </span>
        </div>
      </div>
    </div>
  );
}

export function ToolsMockCard() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const trades = [
    { pair: "EUR/USD Long", pnl: "+$84", positive: true },
    { pair: "NAS100 Short", pnl: "-$52", positive: false },
    { pair: "GBP/USD Long", pnl: "+$116", positive: true },
  ];

  return (
    <div className="w-full max-w-[440px] shrink-0 max-[900px]:max-w-none">
      <div className="rounded-[18px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-[26px] shadow-[0_10px_40px_rgba(0,0,0,0.07)]">
        <div className="mb-[22px]">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="text-[13px] font-bold text-[var(--fba-tx)]">Daily Habit Tracker</div>
            <div className="text-[11px] font-semibold text-[var(--fba-gld-tx)]">7-day streak</div>
          </div>
          <div className="flex gap-[5px]">
            {days.map((day, i) => {
              const isToday = i === days.length - 1;
              return (
                <div
                  key={`${day}-${i}`}
                  className={`flex-1 rounded-[7px] px-1 py-[9px] text-center ${
                    isToday
                      ? "border-[1.5px] border-[var(--fba-ind)] bg-[var(--fba-ind-l)]"
                      : "border border-[color-mix(in_srgb,var(--fba-grn-tx)_30%,var(--fba-surf))] bg-[color-mix(in_srgb,var(--fba-grn-tx)_12%,var(--fba-surf))]"
                  }`}
                >
                  <div
                    className={`text-[8px] font-bold leading-none ${
                      isToday ? "text-[var(--fba-ind-tx)]" : "text-[var(--fba-grn-tx)]"
                    }`}
                  >
                    {day}
                  </div>
                  <div
                    className={`mt-1 text-[9px] font-bold leading-none ${
                      isToday ? "text-[var(--fba-ind-tx)]" : "text-[var(--fba-grn-tx)]"
                    }`}
                  >
                    {isToday ? "→" : "✓"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mb-5 h-px bg-[var(--fba-bdr)]" />
        <div className="mb-5">
          <div className="mb-3 text-[13px] font-bold text-[var(--fba-tx)]">Risk Calculator</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[9px] bg-[var(--fba-bg2)] px-[13px] py-[11px]">
              <div className="mb-[5px] text-[10px] text-[var(--fba-tx3)]">Account Size</div>
              <div className="text-sm font-bold text-[var(--fba-tx)]">$10,000</div>
            </div>
            <div className="rounded-[9px] bg-[var(--fba-bg2)] px-[13px] py-[11px]">
              <div className="mb-[5px] text-[10px] text-[var(--fba-tx3)]">Risk Per Trade</div>
              <div className="text-sm font-bold text-[var(--fba-tx)]">1.0%</div>
            </div>
            <div className="rounded-[9px] bg-[var(--fba-ind-l)] px-[13px] py-[11px]">
              <div className="mb-[5px] text-[10px] text-[var(--fba-ind-tx)]">Max Loss / Trade</div>
              <div className="text-sm font-bold text-[var(--fba-ind-tx)]">$100.00</div>
            </div>
            <div className="rounded-[9px] bg-[color-mix(in_srgb,var(--fba-grn-tx)_12%,var(--fba-surf))] px-[13px] py-[11px]">
              <div className="mb-[5px] text-[10px] text-[var(--fba-grn-tx)]">Daily Limit Safe</div>
              <div className="text-sm font-bold text-[var(--fba-grn-tx)]">$500.00</div>
            </div>
          </div>
        </div>
        <div className="mb-5 h-px bg-[var(--fba-bdr)]" />
        <div>
          <div className="mb-2.5 text-[13px] font-bold text-[var(--fba-tx)]">Trade Journal</div>
          <div className="flex flex-col gap-[5px]">
            {trades.map((trade) => (
              <div
                key={trade.pair}
                className="flex items-center justify-between rounded-[7px] bg-[var(--fba-bg2)] px-[11px] py-[9px]"
              >
                <span className="text-[11px] text-[var(--fba-tx2)]">{trade.pair}</span>
                <span
                  className={`text-[11px] font-bold ${
                    trade.positive ? "text-[var(--fba-grn-tx)]" : "text-[var(--fba-red-tx)]"
                  }`}
                >
                  {trade.pnl}
                </span>
              </div>
            ))}
            <div className="mt-0.5 flex items-center justify-between rounded-[7px] bg-[var(--fba-ind-l)] px-[11px] py-[9px]">
              <span className="text-[11px] font-semibold text-[var(--fba-ind-tx)]">
                Today&apos;s P&amp;L
              </span>
              <span className="text-xs font-extrabold text-[var(--fba-ind-tx)]">+$148</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBullet({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-[13px]">
      <div className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--fba-ind-l)]">
        <div className="h-[7px] w-[7px] rounded-full bg-[var(--fba-ind)]" />
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold leading-[1.2] text-[var(--fba-tx)]">{title}</div>
        <div className="text-[13px] leading-[1.65] text-[var(--fba-tx2)]">{body}</div>
      </div>
    </div>
  );
}

export function DiagnosticSection() {
  return (
    <div
      id="diagnostic"
      className="border-y border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16"
    >
      <div className="mx-auto flex max-w-[1100px] items-center gap-[72px] max-[900px]:flex-col max-[900px]:gap-10">
        <div className="min-w-0 flex-1">
          <div className="mb-[22px] inline-flex items-center gap-2 rounded-[40px] border border-[var(--fba-gld-b)] bg-[var(--fba-gld-l)] px-3.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--fba-gld-tx)]">
              Free · No Signup · 5 Minutes
            </span>
          </div>
          <h2 className="mb-[18px] text-[38px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[30px]">
            Know Exactly Where You Stand Before You Risk a Dollar
          </h2>
          <p className="mb-[30px] text-[15px] leading-[1.75] text-[var(--fba-tx2)]">
            The Trader Readiness Diagnostic gives you a clear, scored breakdown of your evaluation
            readiness across the four areas that actually determine whether you pass or fail a
            funded challenge.
          </p>
          <div className="mb-9 flex flex-col gap-4">
            <FeatureBullet
              title="Risk Management Score"
              body="How well you manage position sizing, drawdown, and daily loss limits."
            />
            <FeatureBullet
              title="Trading Psychology Score"
              body="Your emotional discipline, revenge trading tendencies, and consistency habits."
            />
            <FeatureBullet
              title="Evaluation Rules Awareness"
              body="Knowledge of the specific rules that disqualify most traders from funded accounts."
            />
          </div>
          <Link
            href="/diagnostic"
            className="inline-flex items-center gap-2 rounded-[9px] bg-[var(--fba-ind)] px-[26px] py-[15px] text-sm font-bold text-white no-underline transition-colors hover:bg-[var(--fba-ind-d)]"
          >
            Take the Free Diagnostic →
          </Link>
          <div className="mt-[11px] text-[11px] text-[var(--fba-tx3)]">
            Takes 5 minutes · No account needed · Results are instant
          </div>
        </div>
        <DiagnosticMockCard />
      </div>
    </div>
  );
}

export function ToolsSection() {
  return (
    <div id="tools" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
      <div className="mx-auto flex max-w-[1100px] items-center gap-[72px] max-[900px]:flex-col-reverse max-[900px]:gap-10">
        <ToolsMockCard />
        <div className="min-w-0 flex-1">
          <div className="mb-[22px] inline-flex items-center gap-2 rounded-[40px] border border-[rgba(55,48,163,0.2)] bg-[var(--fba-ind-l)] px-3.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--fba-ind-tx)]">
              Free Forever · No Signup
            </span>
          </div>
          <h2 className="mb-[18px] text-[38px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[30px]">
            Free Practice Tools That Build Real Habits
          </h2>
          <p className="mb-[30px] text-[15px] leading-[1.75] text-[var(--fba-tx2)]">
            The free practice suite gives you the infrastructure to practice like a professional
            before any real evaluation money is at stake.
          </p>
          <div className="mb-9 flex flex-col gap-4">
            <FeatureBullet
              title="Daily Habit Tracker"
              body="Track your daily trading rules, build streaks, and develop the consistency evaluations test for."
            />
            <FeatureBullet
              title="Risk Management Calculator"
              body="Calculate safe position sizes, daily loss limits, and profit targets for any account size."
            />
            <FeatureBullet
              title="Trade Journal"
              body="Log every trade with notes. Over time, patterns emerge, both good habits and recurring mistakes."
            />
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-[9px] border-[1.5px] border-[var(--fba-ind)] bg-[var(--fba-surf)] px-[26px] py-[15px] text-sm font-bold text-[var(--fba-ind-tx)] no-underline transition-colors hover:bg-[var(--fba-ind-l)]"
          >
            Access Free Tools →
          </Link>
        </div>
      </div>
    </div>
  );
}
