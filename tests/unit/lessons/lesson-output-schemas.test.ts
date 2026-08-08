import { describe, expect, it } from "vitest";
import {
  learnerLessonsResponseSchema,
  studioLessonsResponseSchema,
} from "../../../backend/apps/api/src/server/lessons/lesson-schemas";

describe("lesson list output schemas", () => {
  const studioPayload = {
    data: {
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          slug: "audio-lesson",
          title: "Audio lesson",
          position: 1,
          status: "DRAFT",
          lessonType: "audio",
          videoUrl: null,
          durationSeconds: null,
          tags: [],
        },
      ],
    },
  };

  it("preserves lessonType when studio schema is parsed first in the union", () => {
    const parsed = studioLessonsResponseSchema
      .or(learnerLessonsResponseSchema)
      .parse(studioPayload);

    expect(parsed.data.items[0]?.lessonType).toBe("audio");
    expect(parsed.data.items[0]?.status).toBe("DRAFT");
  });

  it("strips lessonType when learner schema is parsed first in the union", () => {
    const parsed = learnerLessonsResponseSchema
      .or(studioLessonsResponseSchema)
      .parse(studioPayload);

    expect(parsed.data.items[0]).not.toHaveProperty("lessonType");
    expect(parsed.data.items[0]).not.toHaveProperty("status");
  });
});
