import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  createMarketingEvent,
  getPublicMarketingEvent,
  publishMarketingEvent,
  queueDueMarketingEventReminders,
  registerPublicMarketingEvent,
  unpublishMarketingEvent,
  updateMarketingEvent,
} from "../../../backend/apps/api/src/server/marketing-events/marketing-events.service";
import {
  createMarketingForm,
  getMarketingForm,
  getPublicMarketingForm,
  publishMarketingForm,
  submitPublicMarketingForm,
  updateMarketingFormFields,
} from "../../../backend/apps/api/src/server/marketing-forms/marketing-forms.service";
import {
  readTenantDefaultTimezone,
  updateTenantDefaultTimezone,
} from "../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S1.14 against Postgres: event confirmation and reminder emails, event
 * times in the academy's zone (review 2 H29); form field types, sign-up forms
 * without passwords (H30).
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function asAdmin<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
}

/** A visitor with no account, as the public routes run. */
function asVisitor<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(
    { tenantId: fixture.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    fn,
  );
}

type EmailRow = { payload_json: Record<string, unknown> };

async function eventEmails(fixture: CourseAuthoringFixture, registrationId: string) {
  return asAdmin(
    fixture,
    (tx) =>
      tx.$queryRaw<EmailRow[]>`
        select payload_json from outbox_events
        where event_type = 'marketing.event_email_requested'
          and aggregate_id::text = ${registrationId}
        order by available_at
      `,
  );
}

async function registrationId(fixture: CourseAuthoringFixture, eventId: string, email: string) {
  const rows = await asAdmin(
    fixture,
    (tx) =>
      tx.$queryRaw<Array<{ id: string }>>`
        select id::text from marketing_event_registrations
        where event_id = ${eventId}::uuid and email = ${email}
      `,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("registration missing");
  return id;
}

async function liveEvent(fixture: CourseAuthoringFixture, startsInHours: number, reminder: number) {
  const startsAt = new Date(Date.now() + startsInHours * 3_600_000).toISOString();
  const created = await asAdmin(fixture, (tx) =>
    createMarketingEvent(tx, adminCtx(fixture), { title: "S1.14 Live trading Q&A", startsAt }),
  );
  const id = created.data.id;
  await asAdmin(fixture, (tx) =>
    updateMarketingEvent(tx, adminCtx(fixture), id, {
      title: "S1.14 Live trading Q&A",
      startsAt,
      location: "Online",
      joinUrl: "https://meet.example.com/qa",
      reminderMinutesBefore: reminder,
    }),
  );
  await asAdmin(fixture, (tx) => publishMarketingEvent(tx, adminCtx(fixture), id));
  return { id, startsAt };
}

describeWithDb("event emails and time zone (S1.14, review 2 H29)", () => {
  it("reads and sets each academy's own time zone", async () => {
    const first = await createCourseAuthoringFixture();
    const second = await createCourseAuthoringFixture();
    await asAdmin(second, (tx) => updateTenantDefaultTimezone(tx, "Europe/London"));
    await asAdmin(first, (tx) => updateTenantDefaultTimezone(tx, "Asia/Kolkata"));
    // Setting one academy's zone used to change every academy's.
    expect(await asAdmin(first, (tx) => readTenantDefaultTimezone(tx))).toBe("Asia/Kolkata");
    expect(await asAdmin(second, (tx) => readTenantDefaultTimezone(tx))).toBe("Europe/London");
    expect(await asVisitor(second, (tx) => readTenantDefaultTimezone(tx))).toBe("Europe/London");
  });

  it("queues one confirmation per registration, in the academy's time zone", async () => {
    const fixture = await createCourseAuthoringFixture();
    await asAdmin(fixture, (tx) => updateTenantDefaultTimezone(tx, "Asia/Kolkata"));
    const event = await liveEvent(fixture, 48, 60);

    const publicEvent = await asVisitor(fixture, (tx) => getPublicMarketingEvent(tx, event.id));
    expect(publicEvent.data.timeZone).toBe("Asia/Kolkata");

    const email = `visitor-${randomUUID().slice(0, 8)}@example.com`;
    const register = () =>
      asVisitor(fixture, (tx) =>
        registerPublicMarketingEvent(
          tx,
          { tenantId: fixture.tenantId, requestId: randomUUID() },
          event.id,
          { email, name: "Asha" },
          { siteUrl: "https://academy.example.com" },
        ),
      );

    expect((await register()).data.alreadyRegistered).toBe(false);
    const id = await registrationId(fixture, event.id, email);
    const emails = await eventEmails(fixture, id);
    expect(emails).toHaveLength(1);
    const payload = emails[0]?.payload_json ?? {};
    expect(payload["kind"]).toBe("confirmation");
    expect(payload["to"]).toBe(email);
    expect(payload["subject"]).toBe("You're registered: S1.14 Live trading Q&A");
    expect(String(payload["body"])).toContain("India Standard Time");
    expect(String(payload["body"])).toContain("https://meet.example.com/qa");
    expect(String(payload["body"])).toContain(`https://academy.example.com/events/${event.id}`);

    // Registering again sends nothing more.
    expect((await register()).data.alreadyRegistered).toBe(true);
    expect(await eventEmails(fixture, id)).toHaveLength(1);
  });

  it("queues each due reminder once, and again after the start time changes", async () => {
    const fixture = await createCourseAuthoringFixture();
    // Starts in 2 hours with a 1-day reminder: the reminder time has passed.
    const event = await liveEvent(fixture, 2, 24 * 60);
    const early = `early-${randomUUID().slice(0, 8)}@example.com`;
    const late = `late-${randomUUID().slice(0, 8)}@example.com`;
    for (const email of [early, late]) {
      await asVisitor(fixture, (tx) =>
        registerPublicMarketingEvent(
          tx,
          { tenantId: fixture.tenantId, requestId: randomUUID() },
          event.id,
          { email },
          { siteUrl: null },
        ),
      );
    }
    // The early one registered before the reminder time; the late one after it.
    await asAdmin(
      fixture,
      (tx) =>
        tx.$executeRaw`
          update marketing_event_registrations set created_at = now() - interval '3 days'
          where event_id = ${event.id}::uuid and email = ${early}
        `,
    );

    const sweep = () =>
      asVisitor(fixture, (tx) =>
        queueDueMarketingEventReminders(tx, {
          tenantId: fixture.tenantId,
          requestId: randomUUID(),
        }),
      );
    expect(await sweep()).toBe(1);
    expect(await sweep()).toBe(0);

    const earlyId = await registrationId(fixture, event.id, early);
    const lateId = await registrationId(fixture, event.id, late);
    const reminders = (await eventEmails(fixture, earlyId)).filter(
      (row) => row.payload_json["kind"] === "reminder",
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.payload_json["subject"]).toBe("Starting soon: S1.14 Live trading Q&A");
    expect(
      (await eventEmails(fixture, lateId)).filter((row) => row.payload_json["kind"] === "reminder"),
    ).toHaveLength(0);

    // Moved by an hour: the reminder is due again.
    await asAdmin(fixture, (tx) => unpublishMarketingEvent(tx, adminCtx(fixture), event.id));
    const moved = new Date(Date.parse(event.startsAt) + 3_600_000).toISOString();
    await asAdmin(fixture, (tx) =>
      updateMarketingEvent(tx, adminCtx(fixture), event.id, {
        title: "S1.14 Live trading Q&A",
        startsAt: moved,
        reminderMinutesBefore: 24 * 60,
      }),
    );
    await asAdmin(fixture, (tx) => publishMarketingEvent(tx, adminCtx(fixture), event.id));
    expect(await sweep()).toBe(1);
  });
});

describeWithDb("form field types and sign-up forms (S1.14, review 2 H30)", () => {
  async function leadForm(fixture: CourseAuthoringFixture) {
    const created = await asAdmin(fixture, (tx) =>
      createMarketingForm(tx, adminCtx(fixture), { title: `S1.14 lead ${randomUUID()}` }),
    );
    return created.data;
  }

  it("saves choice, date and consent fields and checks answers against them", async () => {
    const fixture = await createCourseAuthoringFixture();
    const form = await leadForm(fixture);
    const email = form.fields.find((field) => field.key === "email");
    if (!email) throw new Error("email field missing");

    // A choice field needs options.
    await expect(
      asAdmin(fixture, (tx) =>
        updateMarketingFormFields(tx, adminCtx(fixture), form.id, {
          fields: [
            email,
            {
              id: "f1",
              key: "level",
              label: "Level",
              fieldType: "select",
              required: true,
              sortOrder: 1,
            },
          ],
        }),
      ),
    ).rejects.toThrow(/Add at least one option to "Level"/);

    const saved = await asAdmin(fixture, (tx) =>
      updateMarketingFormFields(tx, adminCtx(fixture), form.id, {
        fields: [
          email,
          {
            id: "f0",
            key: "field_name",
            label: "Your name",
            fieldType: "text",
            required: false,
            sortOrder: 1,
          },
          {
            id: "f1",
            key: "level",
            label: "Level",
            fieldType: "select",
            options: ["New", " Pro ", ""].filter(Boolean),
            required: true,
            sortOrder: 2,
          },
          {
            id: "f2",
            key: "style",
            label: "Style",
            fieldType: "radio",
            options: ["Swing", "Day"],
            required: false,
            sortOrder: 3,
          },
          {
            id: "f3",
            key: "markets",
            label: "Markets",
            fieldType: "checkboxes",
            options: ["FX", "Futures"],
            required: false,
            sortOrder: 4,
          },
          {
            id: "f4",
            key: "start",
            label: "Start date",
            fieldType: "date",
            required: false,
            sortOrder: 5,
          },
          {
            id: "f5",
            key: "news",
            label: "Send me news",
            fieldType: "consent",
            required: true,
            sortOrder: 6,
          },
          // Options on a text field are dropped.
          {
            id: "f6",
            key: "note",
            label: "Note",
            fieldType: "text",
            options: ["x"],
            required: false,
            sortOrder: 7,
          },
        ],
      }),
    );
    const level = saved.data.fields.find((field) => field.key === "level");
    expect(level?.options).toEqual(["New", "Pro"]);
    expect(saved.data.fields.find((field) => field.key === "note")?.options).toBeUndefined();

    await asAdmin(fixture, (tx) => publishMarketingForm(tx, adminCtx(fixture), form.id));
    const submit = (answers: Record<string, unknown>) =>
      asVisitor(fixture, (tx) =>
        submitPublicMarketingForm(
          tx,
          { tenantId: fixture.tenantId, requestId: randomUUID() },
          form.shareToken,
          { answers },
        ),
      );
    const good = {
      email: "lead@example.com",
      field_name: "Ravi Kumar",
      level: "Pro",
      style: "Day",
      markets: ["FX", "Futures"],
      start: "2026-12-01",
      news: true,
    };

    await expect(submit({ ...good, level: "Expert" })).rejects.toThrow(/Choose one of the options/);
    await expect(submit({ ...good, markets: ["Crypto"] })).rejects.toThrow(
      /Choose from the options/,
    );
    await expect(submit({ ...good, start: "next week" })).rejects.toThrow(/must be a date/);
    await expect(submit({ ...good, news: false })).rejects.toThrow(/Tick "Send me news"/);

    const result = await submit(good);
    expect(result.signup).toBeNull();
    const contact = await asAdmin(
      fixture,
      (tx) =>
        tx.$queryRaw<Array<{ display_name: string | null }>>`
          select display_name from marketing_contacts where email = 'lead@example.com'
        `,
    );
    // The name came from a field labelled "name", not a field keyed "name".
    expect(contact[0]?.display_name).toBe("Ravi Kumar");
  });

  it("drops stored password fields and starts the real sign-up instead", async () => {
    const fixture = await createCourseAuthoringFixture();
    const created = await asAdmin(fixture, (tx) =>
      createMarketingForm(tx, adminCtx(fixture), {
        title: `S1.14 signup ${randomUUID()}`,
        kind: "SIGNUP",
      }),
    );
    const form = created.data;
    expect(form.fields.map((field) => [field.key, field.fieldType])).toEqual([
      ["email", "email"],
      ["name", "text"],
      ["accept_terms", "consent"],
    ]);

    // A form saved before the change still holds a password field.
    await asAdmin(
      fixture,
      (tx) =>
        tx.$executeRaw`
          update marketing_forms
          set fields_json = ${JSON.stringify([
            form.fields[0],
            {
              id: "password",
              key: "password",
              label: "Password",
              fieldType: "password",
              required: true,
              isSystem: true,
              sortOrder: 1,
            },
          ])}::jsonb
          where id = ${form.id}::uuid
        `,
    );
    const reread = await asAdmin(fixture, (tx) => getMarketingForm(tx, adminCtx(fixture), form.id));
    expect(reread.data.fields.some((field) => field.key === "password")).toBe(false);
    expect(reread.data.fields.some((field) => field.key === "accept_terms")).toBe(true);

    await asAdmin(fixture, (tx) => publishMarketingForm(tx, adminCtx(fixture), form.id));
    const publicForm = await asVisitor(fixture, (tx) =>
      getPublicMarketingForm(tx, form.shareToken),
    );
    expect(publicForm.data.fields.map((field) => field.fieldType)).not.toContain("password");

    const submit = (answers: Record<string, unknown>) =>
      asVisitor(fixture, (tx) =>
        submitPublicMarketingForm(
          tx,
          { tenantId: fixture.tenantId, requestId: randomUUID() },
          form.shareToken,
          { answers },
        ),
      );
    await expect(
      submit({ email: "new@example.com", name: "Meera Shah", accept_terms: false }),
    ).rejects.toThrow(/Tick/);
    const result = await submit({
      email: "New@Example.com",
      name: "Meera Shah",
      accept_terms: true,
      password: "ignored-and-not-stored",
    });
    expect(result.signup).toEqual({ email: "new@example.com", displayName: "Meera Shah" });

    const stored = await asAdmin(
      fixture,
      (tx) =>
        tx.$queryRaw<Array<{ password_hash: string | null; answers: unknown }>>`
          select c.password_hash, s.answers_json as answers
          from marketing_contacts c
          join marketing_form_submissions s on s.contact_id = c.id
          where c.email = 'new@example.com'
        `,
    );
    expect(stored[0]?.password_hash).toBeNull();
    expect(JSON.stringify(stored[0]?.answers)).not.toContain("ignored-and-not-stored");
  });
});
