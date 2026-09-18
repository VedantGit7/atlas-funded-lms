/**
 * Derived figures for the exchange-rate panel.
 *
 * The cached table is always USD-based (`FX_BASE_CURRENCY` on the server), no
 * matter what a tenant sets as its home currency. Everything here exists to
 * keep that fact visible while still showing the numbers an admin actually
 * wants — rates against their own currency.
 */

/**
 * How old a rate table may be before it is worth warning about.
 *
 * The provider publishes on business days, so a weekend is not staleness. Four
 * days clears a long weekend and still catches a refresh that stopped.
 */
export const FX_STALE_AFTER_MS = 4 * 24 * 60 * 60 * 1000;

export function fxAgeMs(fetchedAt: string | null, now: number = Date.now()): number | null {
  if (fetchedAt === null) return null;
  const time = Date.parse(fetchedAt);
  if (Number.isNaN(time)) return null;
  return Math.max(0, now - time);
}

export function isFxStale(fetchedAt: string | null, now: number = Date.now()): boolean {
  const age = fxAgeMs(fetchedAt, now);
  if (age === null) return false;
  return age >= FX_STALE_AFTER_MS;
}

/**
 * A rate expressed against the home currency.
 *
 * The stored table is USD-based, so a tenant whose home currency is INR needs
 * `rate(X) / rate(INR)` — two hops, not one. Doing this arithmetic in the panel
 * rather than relabelling the USD figures is the difference between a number an
 * admin can act on and one that is quietly wrong by the USD/INR rate.
 *
 * Returns null when either leg is missing, so the cell reads as unknown instead
 * of showing a figure derived from an absent rate.
 */
export function rateAgainstHome(
  rates: Record<string, number>,
  code: string,
  homeCurrency: string,
): number | null {
  const target = rates[code];
  const home = rates[homeCurrency];
  if (target === undefined || home === undefined || home === 0) return null;
  return target / home;
}

/**
 * Rates are quoted to a fixed number of significant figures, not decimals.
 *
 * A currency worth 0.0089 of another and one worth 15.9 both need to be
 * readable; four decimal places renders the first as 0.0089 and the second as
 * 15.9032, but a currency worth 0.00003 would round to 0.0000 and read as free.
 */
export function formatFxRate(rate: number): string {
  if (rate === 0) return "0";
  const magnitude = Math.abs(rate);
  if (magnitude >= 1000) return rate.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (magnitude >= 1) return rate.toLocaleString(undefined, { maximumFractionDigits: 4 });
  // Small rates keep four significant figures rather than four decimals, so a
  // very weak unit never rounds away to zero.
  return rate.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
}

/** The full sentence a rate row means, for the row's accessible label. */
export function rateSentence(homeCurrency: string, code: string, rate: number): string {
  return `1 ${homeCurrency} = ${formatFxRate(rate)} ${code}`;
}
