"use client";

import { Lightbulb } from "lucide-react";
import {
  editorHintClassName,
  editorInputClassName,
  editorLabelClassName,
  editorPanelClassName,
} from "./editor-styles";

type AnswerKeyExplanationEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AnswerKeyExplanationEditor({ value, onChange }: AnswerKeyExplanationEditorProps) {
  return (
    <div
      className={`${editorPanelClassName} motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
        <label className={`${editorLabelClassName} mb-0`} htmlFor="answer-key-explanation">
          Correct answer explanation
        </label>
      </div>
      <p className={editorHintClassName}>
        Optional feedback shown to learners after they answer — explain why the correct response is
        right.
      </p>
      <textarea
        id="answer-key-explanation"
        rows={3}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="e.g. A hammer candle at support often signals buyer rejection and a potential reversal."
        className={`${editorInputClassName} resize-y leading-relaxed`}
      />
    </div>
  );
}
