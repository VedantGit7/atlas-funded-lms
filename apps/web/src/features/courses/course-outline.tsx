type CourseModuleOutlineItem = {
  id: string;
  title: string;
  position: number;
  lessonCount: number;
};

type CourseOutlineProps = {
  modules: CourseModuleOutlineItem[];
};

export function CourseOutline({ modules }: CourseOutlineProps) {
  if (modules.length === 0) {
    return <p role="status">This course does not have a published module outline yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {modules.map((module) => (
        <li key={module.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-60">Module {module.position}</p>
              <h3 className="font-medium">{module.title}</h3>
            </div>
            <span className="text-sm opacity-70">
              {module.lessonCount} {module.lessonCount === 1 ? "lesson" : "lessons"}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
