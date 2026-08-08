"use client";

type LessonTranscriptPanelProps = {
  transcriptText: string;
};

export function LessonTranscriptPanel({ transcriptText }: LessonTranscriptPanelProps) {
  if (!transcriptText.trim()) {
    return null;
  }

  return (
    <section className="space-y-2 rounded border p-4">
      <h2 className="text-lg font-semibold">Transcript</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-90">{transcriptText}</p>
    </section>
  );
}
