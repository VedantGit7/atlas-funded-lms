import { z } from "zod";

export const platformReasonSchema = z
  .string()
  .trim()
  .min(10, "Reason must be at least 10 characters.");

export const PLATFORM_REASON_MIN_LENGTH = 10;
