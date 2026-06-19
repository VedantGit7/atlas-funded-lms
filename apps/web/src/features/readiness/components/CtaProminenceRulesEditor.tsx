"use client";

type CtaProminenceRulesEditorProps = {
  rules: Array<{ bandKey: string; prominence: string }>;
  onChange: (rules: Array<{ bandKey: string; prominence: string }>) => void;
  disabled?: boolean;
};

const prominenceOptions = ["hidden", "subtle", "standard", "prominent"] as const;

export function CtaProminenceRulesEditor({
  rules,
  onChange,
  disabled,
}: CtaProminenceRulesEditorProps) {
  const updateRule = (index: number, patch: Partial<{ bandKey: string; prominence: string }>) => {
    onChange(rules.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)));
  };

  const addRule = () => {
    onChange([...rules, { bandKey: "", prominence: "hidden" }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, idx) => idx !== index));
  };

  return (
    <section className="space-y-3 rounded border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Band prominence rules</h2>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={addRule}
          disabled={disabled}
        >
          Add rule
        </button>
      </div>
      <ul className="space-y-2">
        {rules.map((rule, index) => (
          <li key={`rule-${String(index)}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm">
              Band key
              <input
                className="mt-1 block w-full rounded border px-2 py-1"
                value={rule.bandKey}
                disabled={disabled}
                onChange={(event) => {
                  updateRule(index, { bandKey: event.target.value });
                }}
              />
            </label>
            <label className="text-sm">
              Prominence
              <select
                className="mt-1 block w-full rounded border px-2 py-1"
                value={rule.prominence}
                disabled={disabled}
                onChange={(event) => {
                  updateRule(index, { prominence: event.target.value });
                }}
              >
                {prominenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="self-end rounded border px-3 py-1 text-sm"
              onClick={() => {
                removeRule(index);
              }}
              disabled={disabled || rules.length <= 1}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
