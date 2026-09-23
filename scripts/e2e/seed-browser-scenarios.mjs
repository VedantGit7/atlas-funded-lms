import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";
import { assertIsolatedFixtureTarget } from "./isolated-target.mjs";

const databaseUrl = process.env.E2E_OWNER_DATABASE_URL ?? process.env.DATABASE_URL;
assertIsolatedFixtureTarget({ databaseUrl, authUrl: process.env.SUPABASE_URL });
const path = process.env.E2E_SCENARIO_PATH;
if (!path) throw new Error("E2E_SCENARIO_PATH is required");
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const id = randomUUID;
const run = id().slice(0, 8);
async function insert(table, values) {
  const keys = Object.keys(values);
  await db.query(
    `insert into ${table} (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(values),
  );
}
async function member(prefix) {
  const result = await db.query(
    `select m.id, m.tenant_id from memberships m join auth_principals p on p.id=m.auth_principal_id where p.email=$1 and m.status='ACTIVE'`,
    [process.env[`${prefix}_EMAIL`]],
  );
  if (result.rowCount !== 1) throw new Error(`Expected exactly one active ${prefix} fixture`);
  return result.rows[0];
}
try {
  const learner = await member("E2E_LEARNER"),
    instructor = await member("E2E_INSTRUCTOR"),
    admin = await member("E2E_ADMIN");
  const foreign = await member("E2E_FOREIGN_ADMIN"),
    target = await member("E2E_ROLE_TARGET");
  const tenantId = learner.tenant_id,
    foreignTenantId = foreign.tenant_id;
  const role = await db.query(
    "select id from roles where tenant_id=$1 and key='instructor' and deleted_at is null",
    [tenantId],
  );
  const fixture = {
    tenantId,
    foreignTenantId,
    learnerMembershipId: learner.id,
    instructorMembershipId: instructor.id,
    adminMembershipId: admin.id,
    roleTargetMembershipId: target.id,
    instructorRoleId: role.rows[0].id,
    courseId: id(),
    lessonId: id(),
    assessmentId: id(),
    assessmentItemId: id(),
    correctOptionId: id(),
    foreignCourseId: id(),
    foreignLessonId: id(),
    foreignSentinel: `FOREIGN-PRIVATE-${run}-${id()}`,
    ownCertificateId: id(),
    foreignCertificateId: id(),
  };
  await db.query("BEGIN");
  // This account belongs solely to the role journey. Recover its starting state
  // after an intentionally failed revocation probe, without touching other users.
  await db.query("delete from user_roles where tenant_id=$1 and membership_id=$2 and role_id=$3", [
    tenantId,
    target.id,
    role.rows[0].id,
  ]);
  for (const t of [tenantId, foreignTenantId]) {
    await db.query(
      `insert into entitlements(id,tenant_id,key,value_json,source,starts_at,created_at,updated_at)
      values($1,$2,'certification.enable','true','browser-fixture',now(),now(),now())
      on conflict(tenant_id,key) do update set value_json='true',expires_at=null,updated_at=now()`,
      [id(), t],
    );
  }
  for (const c of [
    {
      tenant: tenantId,
      course: fixture.courseId,
      lesson: fixture.lessonId,
      title: `F16 Learn ${run}`,
      author: instructor.id,
      status: "PUBLISHED",
    },
    {
      tenant: foreignTenantId,
      course: fixture.foreignCourseId,
      lesson: fixture.foreignLessonId,
      title: fixture.foreignSentinel,
      author: foreign.id,
      status: "DRAFT",
    },
  ]) {
    const module = id();
    await insert("courses", {
      id: c.course,
      tenant_id: c.tenant,
      slug: `f16-${c.course}`,
      title: c.title,
      status: c.status,
      metadata_json: {},
      created_by_membership_id: c.author,
      updated_at: new Date(),
    });
    await insert("course_modules", {
      id: module,
      tenant_id: c.tenant,
      course_id: c.course,
      title: "Learning chapter",
      position: 1,
      status: c.status,
      updated_at: new Date(),
    });
    await insert("lessons", {
      id: c.lesson,
      tenant_id: c.tenant,
      module_id: module,
      slug: `lesson-${run}`,
      title: "Resume and complete this lesson",
      content_json: { type: "text", body: "F16 resume lesson" },
      duration_seconds: 600,
      position: 1,
      status: c.status,
      updated_at: new Date(),
    });
  }
  const item = id();
  await insert("items", {
    id: item,
    tenant_id: tenantId,
    item_type_key: "mcq_single",
    stem_json: { stem: "Capital of France?" },
    explanation_json: { answerKey: { correctOptionId: fixture.correctOptionId } },
    status: "PUBLISHED",
    tags: [],
    created_by_membership_id: instructor.id,
    updated_at: new Date(),
  });
  for (const [position, label] of ["Paris", "London"].entries())
    await insert("item_options", {
      id: position === 0 ? fixture.correctOptionId : id(),
      tenant_id: tenantId,
      item_id: item,
      option_json: { label },
      is_correct: position === 0,
      position: position + 1,
      updated_at: new Date(),
    });
  await insert("assessments", {
    id: fixture.assessmentId,
    tenant_id: tenantId,
    slug: `f16-assessment-${run}`,
    title: `F16 Assessment ${run}`,
    assessment_type: "quiz",
    status: "PUBLISHED",
    config_json: {
      createdByMembershipId: instructor.id,
      attemptsAllowed: 2,
      timeLimitSeconds: 3600,
      passMarkPercent: 70,
      shuffleItems: false,
      shuffleOptions: false,
      secureMode: false,
      proctoringLevel: 0,
      l1ProctoringEnabled: false,
      showAnswersPolicy: "after_submit",
    },
    updated_at: new Date(),
  });
  await insert("assessment_items", {
    id: fixture.assessmentItemId,
    tenant_id: tenantId,
    assessment_id: fixture.assessmentId,
    item_id: item,
    position: 1,
    points: 1,
    config_json: { required: true },
  });
  await db.query(
    `insert into workflow_definitions(id,tenant_id,key,name,definition_json,status,created_at,updated_at)
    values($1,$2,'course.publish','Course publish review',$3,'ACTIVE',now(),now())
    on conflict(tenant_id,key) do update set definition_json=excluded.definition_json,status='ACTIVE',updated_at=now()`,
    [
      id(),
      tenantId,
      {
        targetType: "course",
        fromState: "DRAFT",
        reviewState: "REVIEW",
        approvedState: "PUBLISHED",
        rejectedState: "DRAFT",
        actions: ["approve", "reject", "return"],
      },
    ],
  );
  for (const c of [
    {
      tenant: tenantId,
      member: admin.id,
      cert: fixture.ownCertificateId,
      text: `OWN-CERTIFICATE-${run}`,
    },
    {
      tenant: foreignTenantId,
      member: foreign.id,
      cert: fixture.foreignCertificateId,
      text: fixture.foreignSentinel,
    },
  ]) {
    const template = id();
    const design = {
      schemaVersion: 1,
      page: { width: 800, height: 600, unit: "px", orientation: "landscape" },
      background: { type: "color", value: "#ffffff" },
      elements: [
        {
          id: "sentinel",
          type: "text",
          x: 40,
          y: 40,
          width: 720,
          height: 80,
          zIndex: 1,
          text: c.text,
          fontFamily: "Arial",
          fontSize: 20,
          fontWeight: 400,
          color: "#000000",
          align: "left",
        },
      ],
    };
    await insert("certificate_templates", {
      id: template,
      tenant_id: c.tenant,
      key: `f16-${template}`,
      name: `F16 certificate ${run}`,
      template_json: design,
      status: "PUBLISHED",
      updated_at: new Date(),
    });
    await insert("certificates", {
      id: c.cert,
      tenant_id: c.tenant,
      template_id: template,
      membership_id: c.member,
      credential_id: `F16-${c.cert}`,
      status: "issued",
      design_snapshot_json: design,
      recipient_name: c.text,
      updated_at: new Date(),
    });
  }
  await db.query("COMMIT");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2));
  console.log("Seeded isolated browser outcome fixtures.");
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
