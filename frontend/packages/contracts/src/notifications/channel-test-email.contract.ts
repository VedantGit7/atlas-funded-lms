import { z } from "zod";

/** The queued test's identity in the notification pipeline (no template row). */
export const CHANNEL_TEST_EMAIL_TEMPLATE_KEY = "channel.test_email";
export const CHANNEL_TEST_EMAIL_TEMPLATE_ID = "00000000-0000-4000-8000-0000000000e1";

/**
 * "Send test email" on the Transactional Email channel. `direct` hands one
 * email to the provider now and reports its answer; `queued` sends it to the
 * admin through the outbox and the worker, the path real notifications take,
 * and the page polls for the outcome.
 */
export const sendChannelTestEmailBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("direct"), to: z.email() }).strict(),
  z.object({ mode: z.literal("queued") }).strict(),
]);

export const channelTestEmailParamsSchema = z.object({ testId: z.uuid() }).strict();

export const channelTestEmailResultSchema = z.object({
  testId: z.uuid(),
  mode: z.enum(["direct", "queued"]),
  to: z.email(),
  status: z.enum(["queued", "sent", "failed"]),
  /** The provider's or worker's code, e.g. SMTP_550; null unless it failed. */
  errorCode: z.string().nullable(),
  message: z.string(),
});

export const channelTestEmailResponseSchema = z.object({ data: channelTestEmailResultSchema });

export type SendChannelTestEmailBody = z.output<typeof sendChannelTestEmailBodySchema>;
export type ChannelTestEmailResult = z.output<typeof channelTestEmailResultSchema>;
