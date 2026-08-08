import { describe, expect, it } from "vitest";
import {
  createLessonAssetBodySchema,
  createLessonBodySchema,
  lessonProgressBodySchema,
  updateLessonBodySchema,
} from "../../../backend/apps/api/src/server/lessons/lesson-schemas";

describe("lesson schemas", () => {
  it("accepts all studio lesson types on create", () => {
    for (const lessonType of [
      "video",
      "audio",
      "pdf",
      "slides",
      "live",
      "article",
      "scorm",
      "section_quiz",
      "assignment",
    ] as const) {
      const parsed = createLessonBodySchema.parse({
        title: "Intro",
        lessonType,
      });
      expect(parsed.lessonType).toBe(lessonType);
    }
  });

  it("accepts valid lesson create body", () => {
    const parsed = createLessonBodySchema.parse({
      title: "Intro",
      lessonType: "article",
      content: "Hello",
      durationSeconds: 300,
    });
    expect(parsed.title).toBe("Intro");
  });

  it("accepts legacy lesson types on update", () => {
    const parsed = updateLessonBodySchema.parse({
      lessonType: "text",
    });
    expect(parsed.lessonType).toBe("text");
  });

  it("rejects tenant_id on lesson create", () => {
    expect(() =>
      createLessonBodySchema.parse({
        title: "Intro",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("rejects tenantId on lesson update", () => {
    expect(() =>
      updateLessonBodySchema.parse({
        title: "Updated",
        tenantId: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("rejects unsafe identity fields on progress body", () => {
    expect(() =>
      lessonProgressBodySchema.parse({
        completed: true,
        membershipId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects javascript video URLs", () => {
    expect(() =>
      updateLessonBodySchema.parse({
        videoProvider: "youtube",
        videoUrl: "javascript:alert(1)",
      }),
    ).toThrow();
  });

  it("accepts asset create with storage reference", () => {
    const parsed = createLessonAssetBodySchema.parse({
      assetType: "file",
      provider: "r2",
      storageReferenceId: "018f0000-0000-7000-8000-000000000010",
    });
    expect(parsed.provider).toBe("r2");
  });

  it("accepts progress body with position and completion", () => {
    const parsed = lessonProgressBodySchema.parse({
      positionSeconds: 120,
      completed: false,
    });
    expect(parsed.positionSeconds).toBe(120);
  });
});
