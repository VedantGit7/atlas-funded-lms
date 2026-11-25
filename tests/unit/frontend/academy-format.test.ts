import { describe, expect, it } from "vitest";
import {
  createElement,
  useMemo,
  type ReactNode,
} from "../../../frontend/apps/web/node_modules/react";
import {
  renderToPipeableStream,
  renderToStaticMarkup,
} from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { PassThrough } from "node:stream";
import {
  DEFAULT_ACADEMY_FORMAT,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  type AcademyFormat,
} from "../../../frontend/apps/web/src/lib/format/academy-format";
import {
  academyFormatFrom,
  formatMoneyMinor,
  timeZoneName,
} from "../../../frontend/apps/web/src/lib/format/academy-settings";
import { AcademyFormatProvider } from "../../../frontend/apps/web/src/lib/format/academy-format-context";
import { usagePercent } from "../../../frontend/apps/web/src/features/admin/usage/usage-dashboard-utils";
import {
  formatActorLabel,
  humanizeAuditAction,
  humanizeAuditTarget,
} from "../../../frontend/apps/web/src/features/admin/audit/audit-admin-shared";
import { permissionLabel } from "../../../frontend/apps/web/src/features/admin/roles/role-editor-shared";
import { primaryRoleLabel } from "../../../frontend/apps/web/src/components/shells/shared/role-label";

/** 25 Nov 2026, 13:00 UTC: 18:30 in India, 08:00 in New York. */
const MOMENT = "2026-11-25T13:00:00.000Z";

const india = academyFormatFrom({ timeZone: "Asia/Kolkata", currency: "INR" });
const newYork = academyFormatFrom({ timeZone: "America/New_York", currency: "USD" });

function When(): ReactNode {
  return formatDateTime(MOMENT, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Formats inside useMemo, where hooks may not be called. */
function MemoWhen(): ReactNode {
  return useMemo(
    () => formatTime(MOMENT, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    [],
  );
}

function render(format: AcademyFormat, child: () => ReactNode): string {
  return renderToStaticMarkup(
    createElement(AcademyFormatProvider, { value: format }, createElement(child)),
  );
}

/** The streaming renderer, as Next.js renders pages. */
function stream(format: AcademyFormat, child: () => ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new PassThrough();
    sink.on("data", (chunk: Buffer) => (html += chunk.toString()));
    sink.on("end", () => resolve(html));
    const { pipe } = renderToPipeableStream(
      createElement(AcademyFormatProvider, { value: format }, createElement(child)),
      { onAllReady: () => pipe(sink), onError: reject },
    );
  });
}

describe("academy format (S2.4)", () => {
  it("builds the academy's format from its settings", () => {
    expect(india).toEqual({ timeZone: "Asia/Kolkata", locale: "en-IN", currency: "INR" });
    expect(newYork.locale).toBe("en-US");
    // No currency and a bad zone fall back to INR and UTC.
    expect(academyFormatFrom({ timeZone: "Not/AZone", currency: null })).toEqual(
      DEFAULT_ACADEMY_FORMAT,
    );
  });

  it("formats dates in the academy's zone, whatever the server's own clock", () => {
    expect(formatDate(MOMENT, { day: "numeric", month: "short", year: "numeric" }, india)).toBe(
      "25 Nov 2026",
    );
    expect(
      formatTime(MOMENT, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, india),
    ).toBe("18:30");
    expect(
      formatTime(MOMENT, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, newYork),
    ).toBe("08:00");
    // An explicit zone in the options still wins (date-only values use UTC).
    expect(formatDate("2026-11-25", { timeZone: "UTC", day: "numeric" }, newYork)).toBe("25");
  });

  it("groups numbers and money the academy's way", () => {
    expect(formatNumber(100000, undefined, india)).toBe("1,00,000");
    expect(formatNumber(100000, undefined, newYork)).toBe("100,000");
    expect(formatMoneyMinor(149900, null, india)).toBe("₹1,499");
    expect(formatMoneyMinor(149950, "INR", india)).toBe("₹1,499.50");
    expect(timeZoneName("Asia/Kolkata", new Date(MOMENT))).toBe("India Standard Time");
  });

  it("renders each academy's own zone on the server, also inside useMemo", async () => {
    expect(render(india, When)).toBe("18:30");
    expect(render(newYork, When)).toBe("08:00");
    expect(render(india, MemoWhen)).toBe("18:30");
    // Two academies streaming at once each keep their own zone.
    const [a, b] = await Promise.all([stream(india, MemoWhen), stream(newYork, When)]);
    expect(a).toContain("18:30");
    expect(b).toContain("08:00");
  });

  it("lets a nested provider show a learner's own zone", () => {
    const html = renderToStaticMarkup(
      createElement(
        AcademyFormatProvider,
        { value: india },
        createElement(When),
        " | ",
        createElement(AcademyFormatProvider, { value: newYork }, createElement(When)),
      ),
    );
    expect(html).toBe("18:30 | 08:00");
  });
});

describe("plain words and real numbers (S2.4)", () => {
  it("shows the real share of a plan limit, past 100% (review 2 H6)", () => {
    expect(usagePercent(506, 100)).toBe(506);
    expect(usagePercent(50, 100)).toBe(50);
    expect(usagePercent(5, null)).toBeNull();
  });

  it("names audit events, records and people in words (review 2 4.3.2)", () => {
    expect(humanizeAuditAction("certificate.issued")).toBe("Certificate issued");
    expect(humanizeAuditAction("item_import_batch.undone")).toBe("Question import batch undone");
    expect(humanizeAuditTarget("course_lesson")).toBe("Lesson");
    expect(humanizeAuditTarget("course_module")).toBe("Section");
    const ids = {
      actorMembershipId: "92f3cd57-0000-4000-8000-000000000000",
      platformPrincipalId: null,
    };
    expect(formatActorLabel({ ...ids, actorName: "Priya Shah" })).toBe("Priya Shah");
    expect(formatActorLabel({ ...ids, actorName: null })).toBe("A former member");
    expect(formatActorLabel({ actorMembershipId: null, platformPrincipalId: null })).toBe("System");
  });

  it("labels permissions by what they allow, not their code", () => {
    expect(
      permissionLabel({ key: "membership.invite", description: "Invite tenant members" }),
    ).toBe("Invite academy members");
    expect(permissionLabel({ key: "analytics.dashboard.view", description: "" })).toBe(
      "Analytics dashboard view",
    );
  });

  it("shows a member's most senior role in the headers (review 1 m4)", () => {
    expect(primaryRoleLabel(["learner", "admin"])).toBe("Administrator");
    expect(primaryRoleLabel(["instructor"])).toBe("Instructor");
    expect(primaryRoleLabel(["custom_reviewer"])).toBe("Team member");
    expect(primaryRoleLabel([])).toBe("Member");
  });
});
