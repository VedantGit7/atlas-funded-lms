"use client";

type LessonContentEditorProps = {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
};

export function LessonContentEditor({ value, editable, onChange }: LessonContentEditorProps) {
  return (
    <section className="space-y-3 rounded border p-4">
      <h2>Lesson content</h2>
      <textarea
        className="min-h-64 w-full rounded border px-3 py-2 font-mono text-sm"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={!editable}
        aria-label="Lesson content"
      />
    </section>
  );
}
