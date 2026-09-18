"use client";

import { Bold, Italic, Link as LinkIcon, List } from "lucide-react";
import { type RefObject } from "react";
import { lessonToolbarButtonClassName } from "../../lessons/lesson-editor-shared";

type MarkdownToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
};

function wrapSelection(textarea: HTMLTextAreaElement, prefix: string, suffix: string = prefix) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  const before = text.substring(0, start);
  const after = text.substring(end);

  const newText = before + prefix + selectedText + suffix + after;
  textarea.value = newText;

  // Trigger change event
  const event = new Event("input", { bubbles: true });
  textarea.dispatchEvent(event);

  // Restore focus and set cursor position
  textarea.focus();
  textarea.selectionStart = start + prefix.length;
  textarea.selectionEnd = end + prefix.length;
}

function insertList(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  const before = text.substring(0, start);
  const after = text.substring(end);

  // Split selected text into lines and add list markers
  const lines = selectedText.split("\n");
  const listText = lines.map((line) => `- ${line.trim() || "Item"}`).join("\n");

  const newText = before + listText + after;
  textarea.value = newText;

  // Trigger change event
  const event = new Event("input", { bubbles: true });
  textarea.dispatchEvent(event);

  // Restore focus
  textarea.focus();
  textarea.selectionStart = start;
  textarea.selectionEnd = start + listText.length;
}

function insertLink(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  const before = text.substring(0, start);
  const after = text.substring(end);

  const linkText = selectedText || "link text";
  const markdown = `[${linkText}](url)`;

  const newText = before + markdown + after;
  textarea.value = newText;

  // Trigger change event
  const event = new Event("input", { bubbles: true });
  textarea.dispatchEvent(event);

  // Restore focus and select 'url' placeholder
  textarea.focus();
  const urlStart = start + linkText.length + 3; // After "]("
  textarea.selectionStart = urlStart;
  textarea.selectionEnd = urlStart + 3; // Select "url"
}

export function MarkdownToolbar({ textareaRef, disabled }: MarkdownToolbarProps) {
  function handleBold() {
    if (!textareaRef.current || disabled) return;
    wrapSelection(textareaRef.current, "**");
  }

  function handleItalic() {
    if (!textareaRef.current || disabled) return;
    wrapSelection(textareaRef.current, "*");
  }

  function handleLink() {
    if (!textareaRef.current || disabled) return;
    insertLink(textareaRef.current);
  }

  function handleList() {
    if (!textareaRef.current || disabled) return;
    insertList(textareaRef.current);
  }

  return (
    <div
      className={[
        "flex h-11 items-center gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-2",
        disabled ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className={lessonToolbarButtonClassName}
        aria-label="Bold"
        disabled={disabled}
        onClick={handleBold}
      >
        <Bold className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={lessonToolbarButtonClassName}
        aria-label="Italic"
        disabled={disabled}
        onClick={handleItalic}
      >
        <Italic className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={lessonToolbarButtonClassName}
        aria-label="Link"
        disabled={disabled}
        onClick={handleLink}
      >
        <LinkIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={lessonToolbarButtonClassName}
        aria-label="List"
        disabled={disabled}
        onClick={handleList}
      >
        <List className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
