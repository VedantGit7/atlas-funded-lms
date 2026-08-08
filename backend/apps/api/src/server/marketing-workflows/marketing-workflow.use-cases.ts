import { emptyGraph, type WorkflowGraph } from "./marketing-workflow.graph";

export type MarketingUseCase = {
  key: string;
  title: string;
  description: string;
  graph: WorkflowGraph;
};

function node(
  id: string,
  type: "trigger" | "delay" | "condition" | "action",
  title: string,
  config: Record<string, unknown>,
  links: { next?: string | null; onTrue?: string | null; onFalse?: string | null } = {},
) {
  return {
    id,
    type,
    title,
    config,
    next: links.next ?? null,
    onTrue: links.onTrue ?? null,
    onFalse: links.onFalse ?? null,
  };
}

export const MARKETING_WORKFLOW_USE_CASES: MarketingUseCase[] = [
  {
    key: "ebook_lead_magnet",
    title: "Attract Prospective Learners by Sending eBooks",
    description: "When a learner submits a form, email a free resource attachment.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On form submitted", {
          triggerType: "form_submitted",
          formLabel: "Lead form",
        }, { next: "a1" }),
        a1: node("a1", "action", "Send free eBook", {
          actionType: "send_free_resource",
          channel: "email",
          resourceLabel: "Free eBook",
          email: {
            subject: "Your free eBook is ready",
            bodyHtml: "<p>Thanks for your interest. Here is your free eBook.</p>",
          },
        }),
      },
    },
  },
  {
    key: "live_session_webinar",
    title: "Attract Prospective Learners by Conducting a Live Session",
    description: "On form submit: register for a marketing event and send a webinar invite.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On form submitted", {
          triggerType: "form_submitted",
          formLabel: "Webinar form",
        }, { next: "a1" }),
        a1: node("a1", "action", "Register for marketing event", {
          actionType: "register_marketing_event",
          channel: "email",
          eventId: null,
          eventLabel: "Live webinar",
          reminderHours: 24,
          email: {
            subject: "You're registered",
            bodyHtml: "<p>You are registered for our live session.</p>",
          },
        }, { next: "a2" }),
        a2: node("a2", "action", "Send webinar invitation", {
          actionType: "send_webinar_invite",
          channel: "email",
          webinarLabel: "Free live class",
          email: {
            subject: "Join the live webinar",
            bodyHtml: "<p>Here is your webinar join link.</p>",
          },
        }),
      },
    },
  },
  {
    key: "scholarship_test_coupon",
    title: "Increase revenue by conducting a scholarship test",
    description: "On test evaluation, branch by score percentage and send coupons or encouragement.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On test evaluation", {
          triggerType: "test_evaluation",
          testLabel: "Scholarship test",
        }, { next: "c1" }),
        c1: node("c1", "condition", "Score >= 80%", {
          conditionType: "test_percentage",
          operator: "gte",
          value: 80,
        }, { onTrue: "a1", onFalse: "c2" }),
        c2: node("c2", "condition", "Score >= 50%", {
          conditionType: "test_percentage",
          operator: "gte",
          value: 50,
        }, { onTrue: "a2", onFalse: "a3" }),
        a1: node("a1", "action", "Send 40% coupon", {
          actionType: "send_coupon",
          channel: "email",
          couponCode: "SCHOLAR40",
          email: {
            subject: "Congrats! 40% scholarship coupon",
            bodyHtml: "<p>Use code SCHOLAR40 on your next purchase.</p>",
          },
        }),
        a2: node("a2", "action", "Send 10% coupon", {
          actionType: "send_coupon",
          channel: "email",
          couponCode: "SCHOLAR10",
          email: {
            subject: "You earned a 10% coupon",
            bodyHtml: "<p>Use code SCHOLAR10 on your next purchase.</p>",
          },
        }),
        a3: node("a3", "action", "Send encouragement", {
          actionType: "send_message",
          channel: "email",
          email: {
            subject: "Keep going!",
            bodyHtml: "<p>Great effort — try again to unlock a scholarship coupon.</p>",
          },
        }),
      },
    },
  },
  {
    key: "post_purchase_upsell",
    title: "Enhance revenue with post-purchase upsells",
    description: "After payment success, wait, then send a paid enrollment invitation with coupon.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On payment success", {
          triggerType: "payment_success",
          productLabel: "Purchased product",
        }, { next: "d1" }),
        d1: node("d1", "delay", "Wait before upsell", {
          days: 1,
          hours: 0,
          minutes: 0,
        }, { next: "a1" }),
        a1: node("a1", "action", "Send paid enrollment invitation", {
          actionType: "send_paid_enrollment_invite",
          channel: "email",
          productLabel: "Upsell course",
          couponCode: "UPSELL20",
          email: {
            subject: "A special offer for you",
            bodyHtml: "<p>Continue learning with this exclusive offer. Code: UPSELL20</p>",
          },
        }),
      },
    },
  },
  {
    key: "signup_product_link",
    title: "On learner signup send free product link",
    description: "When a learner signs up, send a product link email.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On learner signup", {
          triggerType: "learner_signup",
        }, { next: "a1" }),
        a1: node("a1", "action", "Send product link", {
          actionType: "send_message",
          channel: "email",
          email: {
            subject: "Welcome — explore our free product",
            bodyHtml: "<p>Welcome aboard! Here is your free product link.</p>",
          },
        }),
      },
    },
  },
  {
    key: "pyqp_after_form",
    title: "Expand prospects pipeline by sending PYQPs",
    description: "On form submit, email previous-year question papers as a free resource.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "On form submitted", {
          triggerType: "form_submitted",
          formLabel: "PYQP form",
        }, { next: "a1" }),
        a1: node("a1", "action", "Send question papers", {
          actionType: "send_free_resource",
          channel: "email",
          resourceLabel: "Previous year question papers",
          email: {
            subject: "Your question papers",
            bodyHtml: "<p>Attached are previous year question papers.</p>",
          },
        }),
      },
    },
  },
  {
    key: "expiry_reminder",
    title: "Increase renewal rates with reminders before product expiry",
    description: "Remind learners 3 days before product access expires.",
    graph: {
      entryNodeId: "t1",
      nodes: {
        t1: node("t1", "trigger", "Access expires in 3 days", {
          triggerType: "product_expiry_soon",
          daysBeforeExpiry: 3,
          productLabel: "Subscription product",
        }, { next: "a1" }),
        a1: node("a1", "action", "Send expiry reminder", {
          actionType: "send_message",
          channel: "email",
          email: {
            subject: "Your access expires soon",
            bodyHtml: "<p>Your product access expires in 3 days. Renew to keep learning.</p>",
          },
        }),
      },
    },
  },
];

export function getUseCaseByKey(key: string): MarketingUseCase | null {
  return MARKETING_WORKFLOW_USE_CASES.find((item) => item.key === key) ?? null;
}

export function blankWorkflowGraph(): WorkflowGraph {
  return emptyGraph();
}
