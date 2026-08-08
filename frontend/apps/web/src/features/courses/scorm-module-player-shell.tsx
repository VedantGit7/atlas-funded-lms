"use client";

import Link from "next/link";
import type { z } from "zod";
import type { moduleScormLaunchResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ScormPlayer } from "./scorm-player";

type ScormLaunch = z.infer<typeof moduleScormLaunchResponseSchema>["data"];

type ScormModulePlayerShellProps = {
  courseTitle: string;
  launch: ScormLaunch;
};

export function ScormModulePlayerShell({ courseTitle, launch }: ScormModulePlayerShellProps) {
  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2 border-b pb-4">
        <p className="text-sm opacity-70">
          <Link href="/courses">Courses</Link>
          {" → "}
          <Link href={`/courses/${launch.courseId}`}>{courseTitle}</Link>
          {" → "}
          {launch.title}
        </p>
        <h1 className="text-2xl font-semibold md:text-3xl">{launch.title}</h1>
        <p className="text-sm opacity-70">Interactive SCORM chapter</p>
      </header>

      <ScormPlayer launch={launch} />
    </main>
  );
}
