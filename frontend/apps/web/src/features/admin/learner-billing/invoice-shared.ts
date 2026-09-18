/**
 * Invoice numbering rules, for the settings screen.
 *
 * `formatInvoiceNumber` mirrors `allocateInvoiceNumber` in
 * sales-coupons.service.ts, and the prefix rules mirror
 * `UpdateInvoiceRequestSchema`. Both are duplicated rather than imported —
 * the client bundle cannot pull the domain package — and
 * `tests/unit/admin/invoice-settings.test.ts` asserts the copies agree.
 *
 * The preview matters more here than on most screens: the allocator inserts a
 * hyphen of its own and zero-pads the sequence, so the obvious guess is wrong.
 * A prefix of "INV-" produces "INV--00001", not "INV-1".
 */

export const INVOICE_PREFIX_MAX_LENGTH = 16;
export const INVOICE_PREFIX_PATTERN = /^[A-Za-z0-9_-]+$/;
export const INVOICE_SEQUENCE_PAD = 5;

export function formatInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(INVOICE_SEQUENCE_PAD, "0")}`;
}

/**
 * What the allocator would keep of a prefix, used to show an admin the damage
 * before the field is rejected.
 */
export function sanitiseInvoicePrefix(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, INVOICE_PREFIX_MAX_LENGTH);
}

export type InvoiceFieldErrors = {
  businessName?: string;
  prefix?: string;
  nextNumber?: string;
};

export function parseSequence(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

/** The same conditions `UpdateInvoiceRequestSchema` enforces. */
export function validateInvoice(draft: {
  businessName: string;
  prefix: string;
  nextNumber: string;
}): InvoiceFieldErrors {
  const errors: InvoiceFieldErrors = {};

  if (draft.businessName.trim() === "") {
    errors.businessName = "A business name is required.";
  } else if (draft.businessName.trim().length > 200) {
    errors.businessName = "A business name can be at most 200 characters.";
  }

  const prefix = draft.prefix.trim();
  if (prefix === "") {
    errors.prefix = "A prefix is required.";
  } else if (prefix.length > INVOICE_PREFIX_MAX_LENGTH) {
    errors.prefix = `A prefix can be at most ${INVOICE_PREFIX_MAX_LENGTH} characters.`;
  } else if (!INVOICE_PREFIX_PATTERN.test(prefix)) {
    errors.prefix = "A prefix can use only letters, numbers, hyphens and underscores.";
  }

  const sequence = parseSequence(draft.nextNumber);
  if (sequence === null) {
    errors.nextNumber = "A whole number is required.";
  } else if (sequence < 1) {
    errors.nextNumber = "Numbering starts at 1.";
  } else if (sequence > 1_000_000_000) {
    errors.nextNumber = "That number is too large.";
  }

  return errors;
}
