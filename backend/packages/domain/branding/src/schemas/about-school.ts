import { z } from "zod";

/**
 * "About School" branding detail. Persisted inside tenant_branding's flexible
 * public_landing_copy_json under the `aboutSchool` key, so it flows through the
 * existing branding draft/publish/versioning pipeline without a schema change.
 */

const socialLink = z.string().trim().max(500).nullable();

export const AboutSchoolSocialSchema = z.object({
  facebook: socialLink.default(null),
  instagram: socialLink.default(null),
  twitter: socialLink.default(null),
  linkedin: socialLink.default(null),
  youtube: socialLink.default(null),
  tiktok: socialLink.default(null),
  whatsapp: socialLink.default(null),
  telegram: socialLink.default(null),
  discord: socialLink.default(null),
  pinterest: socialLink.default(null),
  reddit: socialLink.default(null),
  snapchat: socialLink.default(null),
  threads: socialLink.default(null),
  twitch: socialLink.default(null),
  spotify: socialLink.default(null),
  medium: socialLink.default(null),
  github: socialLink.default(null),
  quora: socialLink.default(null),
});

export const AboutSchoolDataSchema = z.object({
  schoolName: z.string().trim().max(60).nullable().default(null),
  browserTitle: z.string().trim().max(60).nullable().default(null),
  about: z.string().trim().max(300).nullable().default(null),
  imageRefId: z.string().uuid().nullable().default(null),
  social: AboutSchoolSocialSchema.default({}),
});

/** GET view: adds the resolved public URL for the stored school image. */
export const AboutSchoolViewSchema = AboutSchoolDataSchema.extend({
  schoolImageUrl: z.string().nullable(),
});

export const AboutSchoolResponseSchema = z.object({
  data: AboutSchoolViewSchema,
});

/** PUT request: school name + browser title are required, the rest optional. */
export const UpdateAboutSchoolRequestSchema = z.object({
  schoolName: z.string().trim().min(1).max(60),
  browserTitle: z.string().trim().min(1).max(60),
  about: z.string().trim().max(300).nullable().default(null),
  imageRefId: z.string().uuid().nullable().default(null),
  social: AboutSchoolSocialSchema.default({}),
});

export type AboutSchoolSocial = z.infer<typeof AboutSchoolSocialSchema>;
export type AboutSchoolData = z.infer<typeof AboutSchoolDataSchema>;
export type AboutSchoolView = z.infer<typeof AboutSchoolViewSchema>;
export type AboutSchoolResponse = z.infer<typeof AboutSchoolResponseSchema>;
export type UpdateAboutSchoolRequest = z.infer<typeof UpdateAboutSchoolRequestSchema>;
