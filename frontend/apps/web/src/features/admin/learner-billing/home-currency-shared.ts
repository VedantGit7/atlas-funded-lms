/**
 * What changing the home currency actually does.
 *
 * The confirmation dialog previously told an admin that "the amount stays the
 * same — an amount of 100 keeps its value, only the symbol changes". That is
 * not what this codebase does. `CoursePrice` renders through `Money`, which
 * calls `useCurrency().format` and converts at live FX rates, so a course
 * stored at 8300 INR is shown to a learner as roughly $100, not as $8,300.
 *
 * The arithmetic here mirrors `convertWith` in CurrencyProvider.tsx so the
 * worked example in the dialog matches what a learner will actually be shown.
 */

/** A representative price for the worked example, in minor units. */
export const HOME_CURRENCY_EXAMPLE_CENTS = 10_000;

/**
 * Convert between two currencies through the USD-based rate table, exactly as
 * `convertWith` does. Null when either leg is missing, so the dialog omits the
 * example rather than inventing a figure.
 */
export function convertExample(
  rates: Record<string, number>,
  amount: number,
  from: string,
  to: string,
): number | null {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (source === target) return amount;
  const fromRate = rates[source];
  const toRate = rates[target];
  if (fromRate === undefined || toRate === undefined || fromRate === 0) return null;
  return (amount * toRate) / fromRate;
}

export function formatExample(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    // Intl throws on a malformed code; the code itself is still informative.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * The before/after a learner would see for one course price, or null when the
 * rate table cannot support the conversion.
 */
export function conversionExample(args: {
  rates: Record<string, number>;
  from: string;
  to: string;
  amountCents?: number;
}): { before: string; after: string } | null {
  const amount = (args.amountCents ?? HOME_CURRENCY_EXAMPLE_CENTS) / 100;
  if (args.from.toUpperCase() === args.to.toUpperCase()) return null;
  const converted = convertExample(args.rates, amount, args.from, args.to);
  if (converted === null) return null;
  return {
    before: formatExample(amount, args.from),
    after: formatExample(converted, args.to),
  };
}
