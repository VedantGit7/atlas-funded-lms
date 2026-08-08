import { describe, expect, it } from "vitest";
import {
  createCustomFieldGroupBodySchema,
  customFieldCohortGroupItemSchema,
  customFieldCohortGroupsQuerySchema,
  customFieldCohortGroupsResponseSchema,
  customFieldCohortMessageItemSchema,
  customFieldCohortMessagesQuerySchema,
  customFieldCohortMessagesResponseSchema,
  retryCustomFieldCohortMessageParamsSchema,
  sendCustomFieldMessageBodySchema,
  sendCustomFieldMessageResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";

describe("custom field cohorts dto", () => {
  it("parses cohort groups query defaults", () => {
    const parsed = customFieldCohortGroupsQuerySchema.parse({ page: "2" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it("parses cohort messages query defaults", () => {
    const parsed = customFieldCohortMessagesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
  });

  it("accepts syncType and criteriaSummary on group create", () => {
    const parsed = createCustomFieldGroupBodySchema.parse({
      title: "Q3 Onboarding",
      syncType: "live",
      criteriaSummary: "Joined >= Q3",
    });
    expect(parsed.syncType).toBe("live");
    expect(parsed.criteriaSummary).toBe("Joined >= Q3");
  });

  it("accepts message body with segment audience and exclude window", () => {
    const parsed = sendCustomFieldMessageBodySchema.parse({
      subject: "Reminder",
      message: "Hello",
      segmentId: "11111111-1111-4111-8111-111111111111",
      segmentName: "Experienced traders",
      excludeMessagedWithinDays: 7,
      audienceCaption: "418 learners in Experienced traders",
    });
    expect(parsed.segmentId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.excludeMessagedWithinDays).toBe(7);
  });

  it("requires campaign fields on send response", () => {
    const parsed = sendCustomFieldMessageResponseSchema.parse({
      data: {
        campaignId: "22222222-2222-4222-8222-222222222222",
        deliveredCount: 10,
        skippedCount: 2,
        failedCount: 1,
        recipientCount: 13,
      },
    });
    expect(parsed.data.failedCount).toBe(1);
  });

  it("validates cohort group and message list shapes", () => {
    const group = customFieldCohortGroupItemSchema.parse({
      batchId: "33333333-3333-4333-8333-333333333333",
      key: "q3-onboarding",
      name: "Q3 Onboarding Track",
      description: null,
      sourceKind: "segment",
      sourceLabel: "Segment · New Hires",
      segmentId: "44444444-4444-4444-8444-444444444444",
      segmentName: "New Hires",
      criteriaSummary: "Joined >= Q3 '23",
      memberCount: 1240,
      syncType: "live",
      createdAt: "2024-10-12T12:00:00.000Z",
      createdByLabel: "J. Doe",
    });
    expect(group.sourceKind).toBe("segment");

    const message = customFieldCohortMessageItemSchema.parse({
      campaignId: "55555555-5555-4555-8555-555555555555",
      subject: "Reminder: Certification expires soon",
      audienceCaption: "418 learners in Experienced traders",
      sourceKind: "segment",
      sourceLabel: "Segment · Experienced traders",
      segmentId: "66666666-6666-4666-8666-666666666666",
      segmentName: "Experienced traders",
      deliveredCount: 411,
      skippedCount: 7,
      failedCount: 0,
      openedCount: null,
      clickedCount: null,
      recipientCount: 418,
      status: "sent",
      sentByLabel: "System",
      sentAt: "2024-11-05T14:30:00.000Z",
      reportHref: "/admin/reports/custom-field/segments/66666666-6666-4666-8666-666666666666",
    });
    expect(message.status).toBe("sent");

    const groupsRes = customFieldCohortGroupsResponseSchema.parse({
      data: {
        items: [group],
        pageInfo: {
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
    expect(groupsRes.data.items).toHaveLength(1);

    const messagesRes = customFieldCohortMessagesResponseSchema.parse({
      data: {
        items: [message],
        pageInfo: {
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
    expect(messagesRes.data.items[0]?.subject).toContain("Reminder");
  });

  it("parses retry campaign params", () => {
    const parsed = retryCustomFieldCohortMessageParamsSchema.parse({
      campaignId: "77777777-7777-4777-8777-777777777777",
    });
    expect(parsed.campaignId).toBe("77777777-7777-4777-8777-777777777777");
  });

  it("rejects tenant fields on cohort message body", () => {
    expect(() =>
      sendCustomFieldMessageBodySchema.parse({
        subject: "x",
        message: "y",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
