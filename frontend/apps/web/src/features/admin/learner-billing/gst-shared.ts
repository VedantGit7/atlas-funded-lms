/**
 * GST field rules and the checkout arithmetic, for the settings screen.
 *
 * Two things are deliberately duplicated here rather than imported:
 *
 * - the GSTIN rules, which live in `UpdateGstRequestSchema` on the server. The
 *   server is the authority; this copy exists only so a typo is caught before a
 *   round trip. `tests/unit/admin/gst-settings.test.ts` asserts the two agree.
 * - `taxCents`, which mirrors `computeTaxCents` in the checkout service. The
 *   preview on this screen is worthless if it rounds differently from the number
 *   a learner is actually charged.
 */

/** 2-digit state code, 10-character PAN, entity number, "Z", checksum. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The mod-36 check digit over the first fourteen characters.
 *
 * The pattern accepts a transposed pair; this does not. The number is printed
 * on learner invoices, where a wrong one makes the tax unclaimable.
 */
export function hasValidGstinChecksum(value: string): boolean {
  if (value.length !== 15) return false;
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const digit = GSTIN_ALPHABET.indexOf(value[index] ?? "");
    if (digit < 0) return false;
    const product = digit * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / GSTIN_ALPHABET.length) + (product % GSTIN_ALPHABET.length);
  }
  const expected = (GSTIN_ALPHABET.length - (sum % GSTIN_ALPHABET.length)) % GSTIN_ALPHABET.length;
  return GSTIN_ALPHABET[expected] === value[14];
}

export function isValidGstin(value: string): boolean {
  const normalised = normaliseGstin(value);
  return GSTIN_PATTERN.test(normalised) && hasValidGstinChecksum(normalised);
}

/** What the server stores: trimmed and upper-cased. */
export function normaliseGstin(value: string): string {
  return value.trim().toUpperCase();
}

/** The Indian GST slabs, offered as shortcuts — a custom rate is still allowed. */
export const GST_SLABS = [5, 12, 18, 28] as const;

export type GstFieldErrors = { number?: string; percentage?: string };

/**
 * The same conditions the server's `superRefine` enforces, checked locally so
 * the fields can be marked before a save is attempted.
 */
export function validateGst(draft: {
  enabled: boolean;
  number: string;
  percentage: string;
}): GstFieldErrors {
  if (!draft.enabled) return {};
  const errors: GstFieldErrors = {};

  const number = normaliseGstin(draft.number);
  if (number === "") {
    errors.number = "A GSTIN is required to enable GST.";
  } else if (!isValidGstin(number)) {
    errors.number = "This is not a valid GSTIN.";
  }

  const percentage = parsePercentage(draft.percentage);
  if (percentage === null) {
    errors.percentage = "A GST percentage is required to enable GST.";
  } else if (percentage <= 0) {
    errors.percentage = "A GST percentage above 0 is required to enable GST.";
  } else if (percentage > 100) {
    errors.percentage = "A GST percentage cannot exceed 100.";
  }

  return errors;
}

/** Null for blank or unparseable input, so a stray character never saves as 0. */
export function parsePercentage(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Tax on an amount, matching `computeTaxCents` in the checkout service exactly
 * — including its `Math.round`, so the preview cannot disagree with the invoice
 * by a paisa.
 */
export function taxCents(amountCents: number, percentage: number | null): number {
  if (percentage === null || percentage <= 0) return 0;
  return Math.max(0, Math.round((amountCents * percentage) / 100));
}

/** A representative base amount for the worked example: one unit of currency ×1000. */
export const PREVIEW_BASE_CENTS = 100_000;

export function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
