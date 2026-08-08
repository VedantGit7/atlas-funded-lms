import type { TenantTx } from "@atlas/db";
import {
  AboutSchoolDataSchema,
  UpdateAboutSchoolRequestSchema,
  type AboutSchoolData,
} from "../schemas/about-school";
import { getTenantBranding, upsertTenantBrandingDraft } from "../repositories/branding.repository";

const ABOUT_SCHOOL_KEY = "aboutSchool";

const EMPTY_ABOUT_SCHOOL: AboutSchoolData = AboutSchoolDataSchema.parse({});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Parse the `aboutSchool` slice out of public_landing_copy_json, tolerant of legacy/partial data. */
function parseAboutSchool(copy: unknown): AboutSchoolData {
  const parsed = AboutSchoolDataSchema.safeParse(asRecord(copy)[ABOUT_SCHOOL_KEY]);
  return parsed.success ? parsed.data : EMPTY_ABOUT_SCHOOL;
}

export async function getAboutSchoolData(tx: TenantTx): Promise<AboutSchoolData> {
  const row = await getTenantBranding(tx);
  if (!row) throw new Error("BRANDING_NOT_FOUND");
  return parseAboutSchool(row.public_landing_copy_json);
}

/**
 * Merge the About School slice into the existing landing copy so sibling keys
 * (e.g. `headline`) are preserved, then persist as a branding draft.
 */
export async function updateAboutSchool(tx: TenantTx, rawInput: unknown): Promise<AboutSchoolData> {
  const input = UpdateAboutSchoolRequestSchema.parse(rawInput);
  const row = await getTenantBranding(tx);
  if (!row) throw new Error("BRANDING_NOT_FOUND");

  const mergedCopy = {
    ...asRecord(row.public_landing_copy_json),
    [ABOUT_SCHOOL_KEY]: input,
  };

  await upsertTenantBrandingDraft(tx, { publicLandingCopy: mergedCopy });
  return parseAboutSchool(mergedCopy);
}
