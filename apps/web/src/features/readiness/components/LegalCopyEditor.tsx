"use client";

type LegalCopyEditorProps = {
  disclaimer: string;
  bandNotes: Record<string, string>;
  legalReviewChecklist: string[];
  onDisclaimerChange: (value: string) => void;
  onBandNotesChange: (value: Record<string, string>) => void;
  onChecklistChange: (value: string[]) => void;
  disabled?: boolean;
};

export function LegalCopyEditor({
  disclaimer,
  bandNotes,
  legalReviewChecklist,
  onDisclaimerChange,
  onBandNotesChange,
  onChecklistChange,
  disabled,
}: LegalCopyEditorProps) {
  const bandEntries = Object.entries(bandNotes);

  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Legal copy</h2>
      <label className="block text-sm">
        Disclaimer
        <textarea
          className="mt-1 block min-h-24 w-full rounded border px-2 py-1"
          value={disclaimer}
          disabled={disabled}
          onChange={(event) => {
            onDisclaimerChange(event.target.value);
          }}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Band notes</h3>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            disabled={disabled}
            onClick={() => {
              onBandNotesChange({
                ...bandNotes,
                [`band_${String(Object.keys(bandNotes).length + 1)}`]: "",
              });
            }}
          >
            Add band note
          </button>
        </div>
        {bandEntries.map(([key, value]) => (
          <label key={key} className="block text-sm">
            {key}
            <textarea
              className="mt-1 block min-h-16 w-full rounded border px-2 py-1"
              value={value}
              disabled={disabled}
              onChange={(event) => {
                onBandNotesChange({
                  ...bandNotes,
                  [key]: event.target.value,
                });
              }}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Legal review checklist</h3>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            disabled={disabled}
            onClick={() => {
              onChecklistChange([...legalReviewChecklist, ""]);
            }}
          >
            Add item
          </button>
        </div>
        {legalReviewChecklist.map((item, index) => (
          <label key={`check-${String(index)}`} className="block text-sm">
            Item {index + 1}
            <input
              className="mt-1 block w-full rounded border px-2 py-1"
              value={item}
              disabled={disabled}
              onChange={(event) => {
                onChecklistChange(
                  legalReviewChecklist.map((entry, idx) =>
                    idx === index ? event.target.value : entry,
                  ),
                );
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
