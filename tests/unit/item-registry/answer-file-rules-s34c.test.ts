import { describe, expect, it } from "vitest";
import {
  answerFileProblem,
  answerFileRules,
  describeAnswerFileTypes,
  fileExtension,
} from "../../../backend/apps/api/src/server/item-registry/answer-rules.contract";
import { validateItemDefinition } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import { rowToItemDefinition } from "../../../backend/apps/api/src/server/item-registry/item-import.contract";
import { assertAllowedMimeType } from "../../../backend/packages/storage/src/mime-policy";
import { assertAllowedSize } from "../../../backend/packages/storage/src/size-policy";
import { buildTenantStorageKey } from "../../../backend/packages/storage/src/key-builder";
import { assertContentMatchesDeclaredType } from "../../../backend/packages/storage/src/content-sniff";
import {
  responseFromWire,
  responseToWire,
} from "../../../frontend/packages/contracts/src/item-registry/answer-ui";

/** QA remediation S3.4c: real files for upload questions (review 1 m26). */

describe("an upload question's file rules", () => {
  it("defaults to everyday documents and images, up to 10 MB (it was PDF only, no limit)", () => {
    const rules = answerFileRules({});
    expect(rules.maxMb).toBe(10);
    expect(rules.types).toEqual(
      expect.arrayContaining(["pdf", "docx", "xlsx", "csv", "png", "jpg"]),
    );
    expect(describeAnswerFileTypes(rules.types)).toBe(
      "PDF, Word, Excel, CSV, Text, PNG, JPG or WebP",
    );
  });

  it("keeps the author's types and size, capped at 25 MB, and drops unknown ones", () => {
    expect(
      answerFileRules({ acceptedFileTypes: [".PDF", "png", "mp4"], maxFileSizeMb: 40 }),
    ).toEqual({ types: ["pdf", "png"], maxMb: 25 });
  });

  it("says what's wrong with a file", () => {
    const rules = { types: ["pdf" as const, "png" as const], maxMb: 1 };
    expect(fileExtension("My Plan.PDF")).toBe("pdf");
    expect(answerFileProblem(rules, { fileName: "plan.pdf", sizeBytes: 500 })).toBeNull();
    expect(answerFileProblem(rules, { fileName: "plan", sizeBytes: 500 })).toBe(
      "Upload one of these file types: PDF or PNG.",
    );
    expect(answerFileProblem(rules, { fileName: "plan.pdf", sizeBytes: 0 })).toBe(
      "This file is empty. Choose another file.",
    );
    expect(answerFileProblem(rules, { fileName: "plan.pdf", sizeBytes: 2_000_000 })).toBe(
      "This file is larger than 1 MB. Choose a smaller file.",
    );
  });

  it("validates the author's choices", () => {
    const base = { itemTypeKey: "file_upload", stem: "Upload your plan.", options: [] };
    expect(
      validateItemDefinition({
        ...base,
        answerKeyJson: { acceptedFileTypes: ["pdf"], maxFileSizeMb: 5 },
      }),
    ).toMatchObject({ ok: true, answerKey: { acceptedFileTypes: ["pdf"], maxFileSizeMb: 5 } });
    const unknown = validateItemDefinition({
      ...base,
      answerKeyJson: { acceptedFileTypes: ["exe"] },
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok)
      expect(unknown.issues[0]?.message).toMatch(/^Learners can't upload \.exe files/);
    expect(validateItemDefinition({ ...base, answerKeyJson: { maxFileSizeMb: 100 } }).ok).toBe(
      false,
    );
  });

  it("reads the size limit from the spreadsheet", () => {
    expect(
      rowToItemDefinition(
        "file_upload",
        { question: "Upload a chart.", accepted_file_types: "png, pdf", max_file_size_mb: 5 },
        [],
      ),
    ).toMatchObject({
      ok: true,
      item: { answerKeyJson: { acceptedFileTypes: ["png", "pdf"], maxFileSizeMb: 5 } },
    });
  });
});

describe("storing an answer file", () => {
  const env = {
    STORAGE_MAX_BRANDING_ASSET_BYTES: 2_000_000,
    STORAGE_MAX_LESSON_ASSET_BYTES: 100_000_000,
  };

  it("takes documents and images, never pages a browser would run, up to 25 MB", () => {
    expect(() =>
      assertAllowedMimeType({
        purpose: "attempt.answer",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).not.toThrow();
    expect(() =>
      assertAllowedMimeType({ purpose: "attempt.answer", contentType: "text/html" }),
    ).toThrow("UNSUPPORTED_ATTEMPT_ANSWER_TYPE");
    expect(() =>
      assertAllowedMimeType({ purpose: "attempt.answer", contentType: "image/svg+xml" }),
    ).toThrow();
    expect(() =>
      assertAllowedSize({ purpose: "attempt.answer", sizeBytes: 26 * 1024 * 1024, env }),
    ).toThrow("ASSET_SIZE_LIMIT_EXCEEDED");
  });

  it("files it under the attempt and checks Office and GIF bytes", () => {
    expect(
      buildTenantStorageKey({
        tenantId: "t",
        purpose: "attempt.answer",
        resourceId: "a",
        fileName: "My Plan.pdf",
      }),
    ).toMatch(/^tenants\/t\/attempts\/a\/[0-9a-f-]+-my-plan\.pdf$/);
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(
      assertContentMatchesDeclaredType({
        declaredType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        head: zip,
      }),
    ).toBe("zip");
    expect(() =>
      assertContentMatchesDeclaredType({ declaredType: "image/gif", head: zip }),
    ).toThrow();
  });
});

describe("the learner's file answer", () => {
  it("sends the confirmed file in a real attempt, and only a name in the preview", () => {
    const uploaded = responseFromWire("file_upload", {
      assetReferenceId: "00000000-0000-4000-8000-000000000001",
      fileName: "plan.pdf",
      sizeBytes: 1200,
      contentType: "application/pdf",
    });
    expect(responseToWire(uploaded)).toEqual({
      assetReferenceId: "00000000-0000-4000-8000-000000000001",
      fileName: "plan.pdf",
      sizeBytes: 1200,
      contentType: "application/pdf",
    });
    expect(responseToWire({ type: "file_upload", fileName: "plan.pdf" })).toEqual({
      fileName: "plan.pdf",
    });
  });
});
